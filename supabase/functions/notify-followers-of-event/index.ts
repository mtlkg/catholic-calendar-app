// Fan-out email notifier: called by a database trigger when a calendar event
// becomes approved. Looks up all followers of the event's organizer and, for
// each follower, enqueues one individual "follower-new-event" email via the
// send-transactional-email function (which uses the shared queue + retry/DLQ
// infrastructure). Each send has its own idempotency key so retries never
// duplicate.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { formatInDioceseZone } from '../_shared/diocese-timezones.ts'
import { isServiceRoleCaller } from '../_shared/caller-auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Only the database trigger (which uses the service_role secret) may invoke this.
  if (!isServiceRoleCaller(req)) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }



  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'server misconfigured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let eventId: string
  try {
    const body = await req.json()
    eventId = String(body?.eventId ?? '')
    if (!eventId) throw new Error('missing eventId')
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  // Look up the event and confirm it's approved.
  const { data: ev, error: evErr } = await supabase
    .from('calendar_events')
    .select('id,title,start_at,venue_name,address,status,submitted_by_user_id,diocese_slug')
    .eq('id', eventId)
    .maybeSingle()

  if (evErr || !ev) {
    console.warn('notify-followers: event not found', { eventId, evErr })
    return new Response(JSON.stringify({ ok: false, reason: 'event_not_found' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if ((ev as any).status !== 'approved') {
    return new Response(JSON.stringify({ ok: true, skipped: 'not_approved' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const organizerId = (ev as any).submitted_by_user_id as string | null
  if (!organizerId) {
    return new Response(JSON.stringify({ ok: true, skipped: 'no_organizer' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Organizer display name.
  const { data: prof } = await supabase
    .from('organizer_profiles')
    .select('org_name')
    .eq('user_id', organizerId)
    .maybeSingle()
  const orgName = ((prof as any)?.org_name || 'An organizer you follow').trim()

  // Followers.
  const { data: followers, error: fErr } = await supabase
    .from('organizer_follows')
    .select('follower_email, follower_user_id, push_endpoint, locale')
    .eq('organizer_user_id', organizerId)

  if (fErr) {
    console.error('notify-followers: follow lookup failed', fErr)
    return new Response(JSON.stringify({ error: 'follower_lookup_failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Notification preferences for followers who have an account.
  const userIds = [...new Set(
    (followers ?? []).map((f: any) => f.follower_user_id).filter(Boolean),
  )] as string[]
  const prefsById = new Map<string, any>()
  if (userIds.length > 0) {
    const { data: prefRows } = await supabase
      .from('notification_prefs')
      .select('*')
      .in('user_id', userIds)
    for (const p of prefRows ?? []) prefsById.set((p as any).user_id, p)
  }

  const startAt = (ev as any).start_at
    ? formatInDioceseZone((ev as any).start_at, (ev as any).diocese_slug)
    : ''
  const venue = [(ev as any).venue_name, (ev as any).address].filter(Boolean).join(' — ')
  const eventUrl = `https://thecatholiccalendar.org/catholic-calendar/event/${eventId}`

  let sent = 0
  let pushSent = 0
  const errors: unknown[] = []
  for (const row of (followers ?? []) as Array<any>) {
    const email = (row.follower_email || '').trim().toLowerCase()
    const prefs = row.follower_user_id ? prefsById.get(row.follower_user_id) : null
    const wantEmail = prefs ? prefs.email_follow_new_event !== false : true
    const locale = String(prefs?.locale || row.locale || 'en')

    if (email && wantEmail) {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serviceKey}`,
            apikey: serviceKey,
          },
          body: JSON.stringify({
            templateName: 'follower-new-event',
            recipientEmail: email,
            idempotencyKey: `follower-event-${eventId}-${email}`,
            templateData: {
              orgName,
              eventTitle: (ev as any).title,
              startAt,
              venue,
              eventUrl,
            },
          }),
        })
        if (!res.ok) {
          const text = await res.text()
          errors.push({ email, status: res.status, body: text })
        } else {
          sent++
        }
      } catch (err) {
        errors.push({ email, error: String(err) })
      }
    }

    // Web push: account holders with the toggle on (all their devices), plus
    // guests who opted in with a specific device on the follow form.
    const wantPushAccount = row.follower_user_id
      ? (prefs ? prefs.push_follow_new_event !== false : true)
      : false
    const pushUserId = wantPushAccount ? row.follower_user_id : null
    const pushEndpoints = row.push_endpoint ? [row.push_endpoint] : []
    if (pushUserId || pushEndpoints.length > 0) {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serviceKey}`,
            apikey: serviceKey,
          },
          body: JSON.stringify({
            templateName: 'follower-new-event',
            locale,
            userId: pushUserId,
            endpoints: pushEndpoints,
            url: eventUrl,
            templateData: { orgName, eventTitle: (ev as any).title, startAt, id: eventId },
          }),
        })
        if (res.ok) pushSent++
        else errors.push({ push: true, status: res.status, body: await res.text() })
      } catch (err) {
        errors.push({ push: true, error: String(err) })
      }
    }

  }

  return new Response(
    JSON.stringify({
      ok: true,
      sent,
      pushSent,
      total: followers?.length ?? 0,
      errors: errors.slice(0, 5),
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
