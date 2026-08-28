// Sends "your event is coming up" reminders to anyone who clicked "Interested".
// Triggered hourly by pg_cron. Sends ~24h before event start, then marks each row
// so the reminder is never sent twice.

import { createClient } from "npm:@supabase/supabase-js@2";
import { formatInDioceseZone } from "../_shared/diocese-timezones.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function isServiceRole(req: Request): boolean {
  const auth = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  try {
    const [, payload] = auth.slice(7).split(".");
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/") +
      "==".slice(0, (4 - (payload.length % 4)) % 4);
    return JSON.parse(atob(b64)).role === "service_role";
  } catch { return false; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!isServiceRole(req)) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Window: events starting between now and 30h from now, with unsent reminders.
  const now = new Date();
  const horizon = new Date(now.getTime() + 30 * 60 * 60 * 1000);

  const { data: interests, error } = await supabase
    .from("event_interests")
    .select("id, email, event_id, user_id, push_endpoint, locale, calendar_events!inner(id, title, start_at, venue_name, address, status, diocese_slug)")
    .is("reminder_sent_at", null)
    .gte("calendar_events.start_at", now.toISOString())
    .lte("calendar_events.start_at", horizon.toISOString())
    .eq("calendar_events.status", "approved")
    .limit(500);

  if (error) {
    console.error("Reminder query failed", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }

  // Preferences for signed-in users who marked interest.
  const userIds = [...new Set((interests ?? []).map((r: any) => r.user_id).filter(Boolean))] as string[];
  const prefsById = new Map<string, any>();
  if (userIds.length > 0) {
    const { data: prefRows } = await supabase
      .from("notification_prefs")
      .select("*")
      .in("user_id", userIds);
    for (const p of prefRows ?? []) prefsById.set((p as any).user_id, p);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  let sent = 0;
  let pushSent = 0;
  for (const row of interests ?? []) {
    const ev: any = (row as any).calendar_events;
    if (!ev) continue;
    const startAt = new Date(ev.start_at);
    const prettyStart = formatInDioceseZone(startAt, ev.diocese_slug);
    const venue = [ev.venue_name, ev.address].filter(Boolean).join(" — ");
    const eventUrl = `https://thecatholiccalendar.org/catholic-calendar/event/${ev.id}`;
    const prefs = (row as any).user_id ? prefsById.get((row as any).user_id) : null;
    const wantEmail = prefs ? prefs.email_event_reminder !== false : true;
    const locale = String(prefs?.locale || (row as any).locale || "en");

    // Web push first — independent of the email result.
    const wantPush = (row as any).user_id
      ? (prefs ? prefs.push_event_reminder !== false : true)
      : false;
    const pushUserId = wantPush ? (row as any).user_id : null;
    const pushEndpoints = (row as any).push_endpoint ? [(row as any).push_endpoint] : [];
    if (pushUserId || pushEndpoints.length > 0) {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
            apikey: serviceKey,
          },
          body: JSON.stringify({
            templateName: "event-reminder",
            locale,
            userId: pushUserId,
            endpoints: pushEndpoints,
            url: eventUrl,
            templateData: { eventTitle: ev.title, startAt: prettyStart, venue, id: ev.id },
          }),
        });
        if (res.ok) pushSent++;
        else console.error("Reminder push failed", row.id, res.status, await res.text());
      } catch (e) {
        console.error("Reminder push threw", row.id, e);
      }
    }


    try {
      if (wantEmail) {
        const { error: mailErr } = await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "event-reminder",
            recipientEmail: (row as any).email,
            idempotencyKey: `event-reminder-${row.id}`,
            templateData: {
              title: ev.title,
              startAt: prettyStart,
              venue,
              eventUrl,
            },
          },
        });
        if (mailErr) {
          // Leave reminder_sent_at null so the next hourly run retries.
          console.error("Reminder email failed", row.id, mailErr.message);
          continue;
        }
      }
      await supabase
        .from("event_interests")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", row.id);
      sent++;
    } catch (e) {
      console.error("Failed to send reminder", row.id, e);
    }
  }



  return new Response(JSON.stringify({ scanned: interests?.length ?? 0, sent, pushSent }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
