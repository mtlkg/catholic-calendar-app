// Flushes batched conversation notifications (DMs + thread replies).
// Runs on a schedule: any conversation with pending messages whose quiet
// window has elapsed gets ONE summary email.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

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

function windowMinutes(freq: string | null | undefined): number {
  switch ((freq || "hourly").toLowerCase()) {
    case "instant":
      return 10;
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

  const { data: rows, error } = await supabase
    .from("notification_digest_state")
    .select("*")
    .gt("pending_count", 0)
    .order("updated_at", { ascending: true })
    .limit(200);
  if (error) return json({ error: error.message }, 500);

  const prefsCache = new Map<string, any>();
  const emailCache = new Map<string, string | null>();
  let sent = 0;
  let skipped = 0;

  for (const row of (rows ?? []) as any[]) {
    const userId = row.user_id as string;

    if (!prefsCache.has(userId)) {
      const { data } = await supabase
        .from("notification_prefs")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      prefsCache.set(userId, data ?? null);
    }
    const prefs = prefsCache.get(userId);
    const isDm = row.kind === "dm";

    // Muted group chats never produce email digests.
    if (String(row.channel ?? "").startsWith("group:")) {
      const groupId = String(row.channel).slice("group:".length);
      const { data: membership } = await supabase
        .from("dm_group_members")
        .select("muted")
        .eq("group_id", groupId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!membership || (membership as any).muted) {
        await supabase.from("notification_digest_state")
          .update({ pending_count: 0, updated_at: new Date().toISOString() })
          .eq("id", row.id);
        skipped++;
        continue;
      }
    }
    const wantEmail = isDm ? prefs?.email_dm ?? true : prefs?.email_thread_reply ?? true;
    const freq = isDm
      ? prefs?.email_dm_frequency ?? "hourly"
      : prefs?.email_thread_reply_frequency ?? "hourly";
    const win = windowMinutes(freq);

    if (!wantEmail || win < 0) {
      await supabase.from("notification_digest_state")
        .update({ pending_count: 0, updated_at: new Date().toISOString() })
        .eq("id", row.id);
      skipped++;
      continue;
    }

    const due = row.last_emailed_at
      ? new Date(new Date(row.last_emailed_at).getTime() + win * 60 * 1000)
      : new Date(0);
    if (due > new Date()) {
      skipped++;
      continue;
    }

    // Read in the app since the last message? Then drop the pending batch.
    if (isDm) {
      const peerId = String(row.channel).slice("dm:".length);
      const { data: state } = await supabase
        .from("dm_conversation_state")
        .select("last_read_at")
        .eq("user_id", userId)
        .eq("peer_user_id", peerId)
        .maybeSingle();
      const lastRead = (state as any)?.last_read_at as string | null;
      if (lastRead && new Date(lastRead) >= new Date(row.updated_at)) {
        await supabase.from("notification_digest_state")
          .update({ pending_count: 0, updated_at: new Date().toISOString() })
          .eq("id", row.id);
        skipped++;
        continue;
      }
    }

    if (!emailCache.has(userId)) {
      const { data } = await supabase
        .from("organizer_profiles")
        .select("contact_email")
        .eq("user_id", userId)
        .maybeSingle();
      emailCache.set(userId, ((data as any)?.contact_email as string) ?? null);
    }
    const email = emailCache.get(userId);
    if (!email) {
      await supabase.from("notification_digest_state")
        .update({ pending_count: 0 })
        .eq("id", row.id);
      skipped++;
      continue;
    }

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
          idempotencyKey: `conv-digest-${row.id}-${row.updated_at}`,
          templateData: {
            kind: row.kind,
            senderName: row.last_sender_name ?? "An organizer",
            threadTitle: row.last_thread_title ?? "",
            excerpt: row.last_excerpt ?? "",
            url: row.last_url ?? "https://thecatholiccalendar.org/catholic-calendar/dashboard",
            count: row.pending_count,
            locale: prefs?.locale ?? "en",
          },
        }),
      });
      if (!res.ok) console.error("digest email failed", row.id, await res.text());
      else sent++;
    } catch (err) {
      console.error("digest email error", row.id, String(err));
    }

    await supabase.from("notification_digest_state")
      .update({
        pending_count: 0,
        last_emailed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
  }

  return json({ ok: true, considered: rows?.length ?? 0, sent, skipped });
});
