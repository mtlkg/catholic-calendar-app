// Stripe webhook: syncs subscriptions & marks featured slots as paid.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createStripeClient, type StripeEnv } from "../_shared/stripe.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function getWebhookSecret(env: StripeEnv): string {
  const k = env === "live" ? "PAYMENTS_LIVE_WEBHOOK_SECRET" : "PAYMENTS_SANDBOX_WEBHOOK_SECRET";
  const v = Deno.env.get(k);
  if (!v) throw new Error(`${k} not configured`);
  return v;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const env: StripeEnv = url.searchParams.get("env") === "live" ? "live" : "sandbox";
  const stripe = createStripeClient(env);
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("missing signature", { status: 400, headers: corsHeaders });

  const body = await req.text();
  let event: any;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, getWebhookSecret(env));
  } catch (err) {
    console.error("Webhook signature failed", err);
    return new Response(`signature failed: ${(err as Error).message}`, { status: 400, headers: corsHeaders });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as any;
        const meta = session.metadata || {};

        // Featured slot one-time purchase — verify amount matches slot's server-side price
        if (meta.kind === "featured_slot" && meta.slotId) {
          const { data: slot } = await supabase
            .from("featured_slots")
            .select("id, event_id, amount_cents, status")
            .eq("id", meta.slotId)
            .maybeSingle();
          if (!slot) {
            console.error("featured_slot webhook: slot not found", meta.slotId);
            break;
          }
          if (slot.status !== "pending") {
            console.error("featured_slot webhook: slot not pending", { slotId: slot.id, status: slot.status });
            break;
          }
          if (meta.eventId && slot.event_id !== meta.eventId) {
            console.error("featured_slot webhook: eventId mismatch", { slotId: slot.id });
            break;
          }
          const paid = Number(session.amount_total ?? 0);
          if (paid < Number(slot.amount_cents)) {
            console.error("featured_slot webhook: underpayment", { expected: slot.amount_cents, paid });
            break;
          }
          await supabase.from("featured_slots").update({
            status: "paid",
            stripe_session_id: session.id,
            stripe_payment_intent_id: session.payment_intent ?? null,
          }).eq("id", slot.id).eq("status", "pending");
          await supabase.from("calendar_events").update({ is_featured: true }).eq("id", slot.event_id);
        }

        // Single event-submission credit purchase for unverified organizers
        if (meta.kind === "event_submission_single" && meta.userId) {
          // Require a minimum paid amount to prevent using a cheap price with this metadata.
          const paid = Number(session.amount_total ?? 0);
          if (paid < 500) {
            console.error("event_submission_single webhook: underpayment", { paid });
            break;
          }
          const { data: prof } = await supabase
            .from("organizer_profiles")
            .select("paid_submissions_remaining")
            .eq("user_id", meta.userId)
            .maybeSingle();
          const current = (prof as any)?.paid_submissions_remaining ?? 0;
          await supabase
            .from("organizer_profiles")
            .update({ paid_submissions_remaining: current + 1 })
            .eq("user_id", meta.userId);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as any;
        const userId = sub.metadata?.userId
          ?? (await stripe.customers.retrieve(sub.customer))?.metadata?.userId;
        if (!userId) { console.warn("subscription has no userId"); break; }
        const item = sub.items?.data?.[0];
        const price = item?.price;
        const priceLookup = price?.lookup_key || price?.id;
        // Map our lookup keys to product_id used by is_paying_verified()
        const productId = String(priceLookup).startsWith("verified_") ? "verified_organizer" : (price?.product as string);
        await supabase.from("subscriptions").upsert({
          user_id: userId,
          stripe_subscription_id: sub.id,
          stripe_customer_id: sub.customer,
          product_id: productId,
          price_id: priceLookup,
          status: sub.status,
          current_period_start: item?.current_period_start ? new Date(item.current_period_start * 1000).toISOString() : null,
          current_period_end: item?.current_period_end ? new Date(item.current_period_end * 1000).toISOString() : null,
          cancel_at_period_end: !!sub.cancel_at_period_end,
          environment: env,
          updated_at: new Date().toISOString(),
        }, { onConflict: "stripe_subscription_id" });

        // Receipt email once verified status is actually paid & active.
        if (
          event.type === "customer.subscription.created" &&
          productId === "verified_organizer" &&
          ["active", "trialing"].includes(String(sub.status))
        ) {
          try {
            const { data: prof } = await supabase
              .from("organizer_profiles")
              .select("org_name, contact_email")
              .eq("user_id", userId)
              .maybeSingle();
            let email = (prof as any)?.contact_email as string | undefined;
            if (!email) {
              const customer = await stripe.customers.retrieve(sub.customer);
              email = (customer as any)?.email ?? undefined;
            }
            if (email) {
              const isYearly = price?.recurring?.interval === "year" ||
                String(priceLookup) === "verified_yearly";
              const cents = Number(price?.unit_amount ?? (isYearly ? 10000 : 1000));
              const periodEnd = item?.current_period_end
                ? new Date(item.current_period_end * 1000)
                : null;
              await supabase.functions.invoke("send-transactional-email", {
                body: {
                  templateName: "verified-payment-receipt",
                  recipientEmail: email,
                  idempotencyKey: `verified-receipt-${sub.id}`,
                  templateData: {
                    orgName: (prof as any)?.org_name || "your organization",
                    plan: isYearly ? "yearly" : "monthly",
                    amount: `$${(cents / 100).toFixed(2)} USD`,
                    nextBillingDate: periodEnd
                      ? periodEnd.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
                      : undefined,
                    manageUrl: "https://thecatholiccalendar.org/catholic-calendar/subscribe",
                  },
                },
              });
            }
          } catch (e) {
            console.error("verified receipt email failed", e);
          }
        }
        break;
      }

    }
  } catch (err) {
    console.error("webhook handler error", err);
    return new Response(`handler error: ${(err as Error).message}`, { status: 500, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
