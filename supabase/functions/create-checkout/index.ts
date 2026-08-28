import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";


async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId?: string },
): Promise<string> {
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) {
    throw new Error("Invalid userId");
  }
  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    if (found.data.length) return found.data[0].id;
  }
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const customer = existing.data[0];
      if (options.userId && customer.metadata?.userId !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    ...(options.userId && { metadata: { userId: options.userId } }),
  });
  return created.id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  try {
    // Authenticate the caller — required for all checkout flows here.
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: userData, error: userErr } = await adminClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const authUserId = userData.user.id;

    const body = await req.json();
    const {
      priceId,
      quantity,
      customerEmail,
      returnUrl,
      environment,
      metadata: extraMetadata,
    } = body ?? {};
    // Force userId to the authenticated caller — ignore client-supplied value.
    const userId = authUserId;

    if (!priceId || !/^[a-zA-Z0-9_-]+$/.test(priceId)) {
      throw new Error("Invalid priceId");
    }
    if (!returnUrl || typeof returnUrl !== "string") {
      throw new Error("Missing returnUrl");
    }
    const env: StripeEnv = environment === "live" ? "live" : "sandbox";

    // Validate metadata for known kinds so a client can't spoof slotId ownership.
    const safeMetadata: Record<string, string> = {};
    if (extraMetadata && typeof extraMetadata === "object") {
      const kind = String((extraMetadata as any).kind ?? "");
      if (kind === "featured_slot") {
        const slotId = String((extraMetadata as any).slotId ?? "");
        const eventId = String((extraMetadata as any).eventId ?? "");
        if (!slotId) throw new Error("slotId required");
        const { data: slot } = await adminClient
          .from("featured_slots")
          .select("id, event_id, amount_cents, status, calendar_events!inner(submitted_by_user_id)")
          .eq("id", slotId)
          .maybeSingle();
        if (!slot) throw new Error("Slot not found");
        if ((slot as any).status !== "pending") throw new Error("Slot not available");
        if ((slot as any).calendar_events?.submitted_by_user_id !== authUserId) {
          throw new Error("Not slot owner");
        }
        if (eventId && (slot as any).event_id !== eventId) throw new Error("Event mismatch");
        safeMetadata.kind = "featured_slot";
        safeMetadata.slotId = slotId;
        safeMetadata.eventId = (slot as any).event_id;
      } else if (kind === "event_submission_single") {
        safeMetadata.kind = "event_submission_single";
        // userId injected below from auth
      }
    }

    const stripe = createStripeClient(env);
    const prices = await stripe.prices.list({ lookup_keys: [priceId] });
    if (!prices.data.length) throw new Error("Price not found");
    const stripePrice = prices.data[0];
    const isRecurring = stripePrice.type === "recurring";

    // For featured_slot, verify the Stripe price amount matches the slot's server-side price.
    if (safeMetadata.kind === "featured_slot") {
      const { data: slot } = await adminClient
        .from("featured_slots")
        .select("amount_cents")
        .eq("id", safeMetadata.slotId)
        .maybeSingle();
      const expected = Number((slot as any)?.amount_cents ?? 0);
      const priceAmount = Number(stripePrice.unit_amount ?? 0);
      if (!expected || priceAmount < expected) {
        throw new Error("Price does not match slot amount");
      }
    }

    const customerId = (customerEmail || userId)
      ? await resolveOrCreateCustomer(stripe, { email: customerEmail, userId })
      : undefined;

    let productDescription: string | undefined;
    if (!isRecurring) {
      const productId = typeof stripePrice.product === "string"
        ? stripePrice.product
        : stripePrice.product.id;
      const product = await stripe.products.retrieve(productId);
      productDescription = product.name;
    }

    const metadata: Record<string, string> = {
      ...safeMetadata,
      userId,
      priceId,
    };


    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: stripePrice.id, quantity: quantity || 1 }],
      mode: isRecurring ? "subscription" : "payment",
      ui_mode: "embedded_page",
      return_url: returnUrl,
      ...(customerId && { customer: customerId }),
      ...(!isRecurring && { payment_intent_data: { description: productDescription, metadata } }),
      metadata,
      ...(isRecurring && { subscription_data: { metadata } }),
    });

    return new Response(JSON.stringify({ clientSecret: session.client_secret }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
