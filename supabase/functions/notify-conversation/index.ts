// Notifies an organizer about a new direct message or a reply to their thread.
// Called by database triggers (service_role).
//
// Email is deliberately quiet: it is batched per conversation using
// public.notification_digest_state and skipped entirely when the recipient has
// already read the conversation. Push stays instant.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { normalizeLocale } from "../_shared/push-templates.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function isServiceRole(req: Request): boolean {
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

const SITE = "https://thecatholiccalendar.org/catholic-calendar/dashboard";

/** Minutes between two emails for the same conversation, per frequency setting. */
export function windowMinutes(freq: string | null | undefined): number {
  switch ((freq || "hourly").toLowerCase()) {
    case "instant":
      return 10; // still guard against rapid-fire bursts
    case "daily":
      return 24 * 60;
    case "off":
      return -1;
    case "hourly":
    default:
      return 60;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!isServiceRole(req)) return json({ error: "forbidden" }, 403);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  let kind: string;
  let recordId: string;
  try {
    const body = await req.json();
    kind = String(body?.kind ?? "");
    recordId = String(body?.recordId ?? "");
    if (!kind || !recordId) throw new Error("kind and recordId required");
  } catch (err) {
    return json({ error: (err as Error).message }, 400);
  }

  let recipientId: string | null = null;
  let senderId: string | null = null;
  let threadTitle = "";
  let excerpt = "";
  let url = SITE;
  let channel = "";
  let createdAt: string | null = null;

  if (kind === "dm") {
    const { data: dm } = await supabase
      .from("direct_messages")
      .select("id, sender_user_id, recipient_user_id, body, created_at")
      .eq("id", recordId)
      .maybeSingle();
    if (!dm) return json({ ok: false, reason: "not_found" });
    recipientId = (dm as any).recipient_user_id;
    senderId = (dm as any).sender_user_id;
    createdAt = (dm as any).created_at;
    excerpt = String((dm as any).body ?? "").slice(0, 160);
    url = `${SITE}?tab=messages&peer=${senderId}`;
    channel = `dm:${senderId}`;
  } else if (kind === "thread_reply") {
    const { data: reply } = await supabase
      .from("discussion_replies")
      .select("id, thread_id, author_user_id, body, created_at")
      .eq("id", recordId)
      .maybeSingle();
    if (!reply) return json({ ok: false, reason: "not_found" });
    senderId = (reply as any).author_user_id;
    createdAt = (reply as any).created_at;
    excerpt = String((reply as any).body ?? "").slice(0, 160);
    const { data: thread } = await supabase
      .from("discussion_threads")
      .select("id, title, author_user_id")
      .eq("id", (reply as any).thread_id)
      .maybeSingle();
    if (!thread) return json({ ok: false, reason: "thread_not_found" });
    recipientId = (thread as any).author_user_id;
    threadTitle = String((thread as any).title ?? "");
    url = `${SITE}?tab=threads&thread=${(thread as any).id}`;
    channel = `thread:${(thread as any).id}`;
  } else {
    return json({ error: "unknown kind" }, 400);
  }

  if (!recipientId || recipientId === senderId) {
    return json({ ok: true, skipped: "self_or_missing" });
  }

  // Sender display name.
  const { data: senderProfile } = await supabase
    .from("organizer_profiles")
    .select("org_name")
    .eq("user_id", senderId)
    .maybeSingle();
  const senderName = ((senderProfile as any)?.org_name || "An organizer").trim();

  // Recipient prefs (defaults: email on, hourly batching).
  const { data: prefs } = await supabase
    .from("notification_prefs")
    .select("*")
    .eq("user_id", recipientId)
    .maybeSingle();

  const wantEmail = kind === "dm"
    ? (prefs as any)?.email_dm ?? true
    : (prefs as any)?.email_thread_reply ?? true;
  const wantPush = kind === "dm"
    ? (prefs as any)?.push_dm ?? true
    : (prefs as any)?.push_thread_reply ?? true;
  const frequency = kind === "dm"
    ? (prefs as any)?.email_dm_frequency ?? "hourly"
    : (prefs as any)?.email_thread_reply_frequency ?? "hourly";
  const locale = normalizeLocale((prefs as any)?.locale);

  const results: Record<string, unknown> = {};

  // ---- Push: always immediate. ----
  if (wantPush) {
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
        },
        body: JSON.stringify({
          templateName: kind === "dm" ? "dm" : "thread-reply",
          locale,
          userId: recipientId,
          url,
          templateData: { senderName, threadTitle, id: recordId },
        }),
      });
      results.push = res.ok ? "sent" : `failed:${res.status}`;
      if (!res.ok) console.error("notify-conversation push failed", await res.text());
    } catch (err) {
      results.push = `error:${String(err)}`;
    }
  }

  const winMinutes = windowMinutes(frequency);
  if (!wantEmail || winMinutes < 0) {
    return json({ ok: true, ...results, email: "disabled" });
  }

  // ---- Already read in the app? Then no email at all. ----
  if (kind === "dm") {
    const { data: state } = await supabase
      .from("dm_conversation_state")
      .select("last_read_at")
      .eq("user_id", recipientId)
      .eq("peer_user_id", senderId)
      .maybeSingle();
    const lastRead = (state as any)?.last_read_at as string | null;
    if (lastRead && createdAt && new Date(lastRead) >= new Date(createdAt)) {
      return json({ ok: true, ...results, email: "already_read" });
    }
  }

  // ---- Batch: bump the pending counter for this conversation. ----
  const { data: digest } = await supabase
    .from("notification_digest_state")
    .select("id, pending_count, last_emailed_at")
    .eq("user_id", recipientId)
    .eq("channel", channel)
    .maybeSingle();

  const pendingCount = ((digest as any)?.pending_count ?? 0) + 1;
  const lastEmailedAt = (digest as any)?.last_emailed_at as string | null;
  const dueAt = lastEmailedAt
    ? new Date(new Date(lastEmailedAt).getTime() + winMinutes * 60 * 1000)
    : null;
  const sendNow = !dueAt || dueAt <= new Date();

  const row = {
    user_id: recipientId,
    channel,
    kind,
    pending_count: sendNow ? 0 : pendingCount,
    last_emailed_at: sendNow ? new Date().toISOString() : lastEmailedAt,
    last_excerpt: excerpt,
    last_sender_name: senderName,
    last_thread_title: threadTitle,
    last_url: url,
    updated_at: new Date().toISOString(),
  };
  await supabase
    .from("notification_digest_state")
    .upsert(row, { onConflict: "user_id,channel" });

  if (!sendNow) {
    return json({ ok: true, ...results, email: "batched", pending: pendingCount });
  }

  const { data: recipientProfile } = await supabase
    .from("organizer_profiles")
    .select("contact_email")
    .eq("user_id", recipientId)
    .maybeSingle();
  const email = (recipientProfile as any)?.contact_email as string | null;
  if (!email) return json({ ok: true, ...results, email: "no_address" });

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
      body: JSON.stringify({
        templateName: "conversation-notification",
        recipientEmail: email,
        idempotencyKey: `conv-${kind}-${recordId}`,
        templateData: { kind, senderName, threadTitle, excerpt, url, count: pendingCount, locale },
      }),
    });
    results.email = res.ok ? "sent" : `failed:${res.status}`;
    if (!res.ok) console.error("notify-conversation email failed", await res.text());
  } catch (err) {
    results.email = `error:${String(err)}`;
  }

  return json({ ok: true, ...results });
});
