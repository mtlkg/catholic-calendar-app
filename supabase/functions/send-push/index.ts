// Shared web push sender. Internal-only: callable by the service role (other
// edge functions / database triggers). Looks up the target subscriptions,
// renders localized copy, encrypts and delivers each message, and prunes
// subscriptions the push service reports as gone.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { normalizeLocale, renderPush, type PushTemplate } from "../_shared/push-templates.ts";
import { sendWebPush } from "../_shared/webpush.ts";

function isInternalCaller(req: Request): boolean {
  const auth = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  const token = auth.slice(7).trim();
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (serviceKey && token === serviceKey) return true;
  try {
    const [, payload] = token.split(".");
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/") +
      "==".slice(0, (4 - (payload.length % 4)) % 4);
    return JSON.parse(atob(b64)).role === "service_role";
  } catch {
    return false;
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!isInternalCaller(req)) return json({ error: "forbidden" }, 403);

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const template = String(payload?.templateName ?? "") as PushTemplate;
  const locale = normalizeLocale(payload?.locale);
  const data = (payload?.templateData ?? {}) as Record<string, string>;
  const url = String(payload?.url ?? "https://thecatholiccalendar.org/catholic-calendar");
  const userId: string | null = payload?.userId ?? null;
  const endpoints: string[] = Array.isArray(payload?.endpoints) ? payload.endpoints : [];

  if (!template) return json({ error: "templateName required" }, 400);
  if (!userId && endpoints.length === 0) return json({ ok: true, skipped: "no_target" });

  const privateJwkRaw = Deno.env.get("VAPID_PRIVATE_JWK");
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT") || "mailto:globalcatholiccalendar@gmail.com";
  if (!privateJwkRaw || !publicKey) {
    console.error("send-push: VAPID keys are not configured");
    return json({ error: "push not configured" }, 503);
  }
  const privateJwk = JSON.parse(privateJwkRaw) as JsonWebKey;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const subs = new Map<string, { endpoint: string; p256dh: string; auth: string; locale: string }>();
  if (userId) {
    const { data: rows } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth, locale")
      .eq("user_id", userId);
    for (const r of rows ?? []) subs.set((r as any).endpoint, r as any);
  }
  if (endpoints.length > 0) {
    const { data: rows } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth, locale")
      .in("endpoint", endpoints);
    for (const r of rows ?? []) subs.set((r as any).endpoint, r as any);
  }

  if (subs.size === 0) return json({ ok: true, skipped: "no_subscriptions" });

  let sent = 0;
  const dead: string[] = [];
  const errors: unknown[] = [];

  for (const sub of subs.values()) {
    const loc = normalizeLocale(payload?.locale ?? sub.locale) ?? locale;
    let built;
    try {
      built = renderPush(template, loc, data);
    } catch (err) {
      return json({ error: (err as Error).message }, 400);
    }
    try {
      const res = await sendWebPush(sub, {
        title: built.title,
        body: built.body,
        url,
        tag: `${template}-${data.id ?? ""}`,
      }, { privateJwk, publicKey, subject });
      if (res.ok) sent++;
      else if (res.gone) dead.push(sub.endpoint);
      else errors.push({ endpoint: sub.endpoint, status: res.status, body: res.body });
    } catch (err) {
      errors.push({ endpoint: sub.endpoint, error: String(err) });
    }
  }

  if (dead.length > 0) {
    await supabase.from("push_subscriptions").delete().in("endpoint", dead);
  }

  return json({ ok: true, sent, pruned: dead.length, errors: errors.slice(0, 5) });
});
