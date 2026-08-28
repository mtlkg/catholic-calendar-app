import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { TEMPLATES } from '../_shared/transactional-email-templates/registry.ts'
import { formatInDioceseZone } from '../_shared/diocese-timezones.ts'

// Configuration baked in at scaffold time — do NOT change these manually.
// To update, re-run the email domain setup flow.
const SITE_NAME = "The Catholic Calendar"
// SENDER_DOMAIN is the verified sender subdomain FQDN (e.g., "notify.example.com").
// It MUST match the subdomain delegated to Lovable's nameservers — never the root domain.
// The email API looks up this exact domain; a mismatch causes "No email domain record found".
const SENDER_DOMAIN = "notify.thecatholiccalendar.org"
// FROM_DOMAIN is the domain shown in the From: header (e.g., "example.com").
// When display_from_root is enabled, this can be the root domain for cleaner branding,
// even though actual sending uses the subdomain above.
const FROM_DOMAIN = "thecatholiccalendar.org"

// Generate a cryptographically random 32-byte hex token
function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// Auth model:
//  - verify_jwt=true (config.toml) means Supabase's gateway rejects requests
//    with no/invalid JWT before they reach this handler.
//  - Because the anon key is a valid JWT, we ALSO enforce a per-template
//    allow-list here so a leaked anon key can't be used to spam arbitrary
//    templates (e.g. approval/reminder emails) at arbitrary addresses.
const ANON_ALLOWED_TEMPLATES = new Set<string>([
  // Signup flow — user is not yet signed in when these are sent
  'admin-organizer-applied',
  'organizer-application-received',
  // Public "I'm interested" click on an event
  'organizer-new-interest',
  // Public "Follow" click on an organizer
  'organizer-new-follower',
  // Guest event submissions — recipient is forced server-side below
  'admin-event-submitted',
  'event-submission-received',
])

const AUTHENTICATED_ALLOWED_TEMPLATES = new Set<string>([
  ...ANON_ALLOWED_TEMPLATES,
])

const ADMIN_ONLY_TEMPLATES = new Set<string>([
  'event-approved',
  'event-rejected',
  'organizer-approved',
])

// service_role and cron-only templates: any template not covered above
// (e.g. 'event-reminder', 'thread-expired') requires service_role.

function decodeJwtRole(req: Request): { role: string; sub: string | null } {
  const auth = req.headers.get('Authorization') || req.headers.get('authorization') || ''
  const apikey = req.headers.get('apikey') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  // Newer Supabase secret keys ("sb_secret_...") are opaque, not JWTs, so the
  // role can't be decoded — match them against the service-role key directly.
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (serviceKey && (token === serviceKey || apikey === serviceKey)) {
    return { role: 'service_role', sub: null }
  }
  if (!token) return { role: 'anon', sub: null }
  try {
    const [, payload] = token.split('.')
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/') +
      '=='.slice(0, (4 - (payload.length % 4)) % 4)
    const decoded = JSON.parse(atob(b64))
    return { role: decoded.role ?? 'anon', sub: decoded.sub ?? null }
  } catch {
    return { role: 'anon', sub: null }
  }
}


function normalizeEmailLocale(value: unknown): 'en' | 'fr' | 'es' {
  const l = typeof value === 'string' ? value.toLowerCase() : ''
  if (l.startsWith('fr')) return 'fr'
  if (l.startsWith('es')) return 'es'
  return 'en'
}

function localeTag(locale: 'en' | 'fr' | 'es'): string {
  if (locale === 'fr') return 'fr-CA'
  if (locale === 'es') return 'es-ES'
  return 'en-US'
}



Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing required environment variables')
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // Parse request body
  let templateName: string
  let recipientEmail: string
  let idempotencyKey: string
  let messageId: string
  let templateData: Record<string, any> = {}
  try {
    const body = await req.json()
    templateName = body.templateName || body.template_name
    recipientEmail = body.recipientEmail || body.recipient_email
    messageId = crypto.randomUUID()
    idempotencyKey = body.idempotencyKey || body.idempotency_key || messageId
    if (body.templateData && typeof body.templateData === 'object') {
      templateData = body.templateData
    }
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON in request body' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  if (!templateName) {
    return new Response(
      JSON.stringify({ error: 'templateName is required' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // 1. Look up template from registry (early — needed to resolve recipient)
  let template = TEMPLATES[templateName]

  if (!template) {
    console.error('Template not found in registry', { templateName })
    return new Response(
      JSON.stringify({
        error: `Template '${templateName}' not found. Available: ${Object.keys(TEMPLATES).join(', ')}`,
      }),
      {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // Create Supabase client with service role (bypasses RLS)
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // --- Per-template authorization ---
  const caller = decodeJwtRole(req)
  if (caller.role !== 'service_role') {
    let allowed = false
    if (caller.role === 'anon') {
      allowed = ANON_ALLOWED_TEMPLATES.has(templateName)
    } else if (caller.role === 'authenticated') {
      allowed = AUTHENTICATED_ALLOWED_TEMPLATES.has(templateName)
      if (!allowed && ADMIN_ONLY_TEMPLATES.has(templateName) && caller.sub) {
        const { data: adminRow } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', caller.sub)
          .eq('role', 'admin')
          .maybeSingle()
        allowed = !!adminRow
      }
    }
    if (!allowed) {
      console.warn('Blocked unauthorized template send', { role: caller.role, templateName })
      return new Response(
        JSON.stringify({ error: 'not authorized for this template' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
  }

  // --- Server-side derivation for non-service_role callers ---
  // For templates callable by anon/authenticated users, we MUST NOT trust the
  // caller-supplied recipient or templateData. Look up the real entity from
  // the database using an ID and derive both server-side. This prevents abuse
  // of the verified sending domain for spam/phishing to arbitrary addresses.
  const ADMIN_EMAIL = 'globalcatholiccalendar@gmail.com'

  if (caller.role !== 'service_role') {
    const requestedLocale = normalizeEmailLocale((templateData as any)?.locale)
    if (templateName === 'organizer-new-interest') {
      const eventId = (templateData as any)?.eventId
      const interestedEmailRaw = (templateData as any)?.interestedEmail
      if (typeof eventId !== 'string' || typeof interestedEmailRaw !== 'string') {
        return new Response(
          JSON.stringify({ error: 'eventId and interestedEmail required in templateData' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
      const interestedEmail = interestedEmailRaw.toLowerCase()
      const { data: interestRow } = await supabase
        .from('event_interests')
        .select('id')
        .eq('event_id', eventId)
        .eq('email', interestedEmail)
        .maybeSingle()
      if (!interestRow) {
        return new Response(
          JSON.stringify({ error: 'interest record not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
      const { data: ev } = await supabase
        .from('calendar_events')
        .select('title,start_at,guest_email,submitted_by_user_id,diocese_slug')
        .eq('id', eventId)
        .maybeSingle()
      if (!ev) {
        return new Response(
          JSON.stringify({ error: 'event not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
      // Only notify verified organizers. Guest submissions (no user_id) and
      // unverified accounts don't receive interest-notification emails — this
      // is a verified-organizer perk (see AccountTypes).
      const submitterUserId = (ev as any).submitted_by_user_id as string | null
      if (!submitterUserId) {
        return new Response(
          JSON.stringify({ success: false, reason: 'organizer_not_verified' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
      const { data: prof } = await supabase
        .from('organizer_profiles')
        .select('contact_email,status')
        .eq('user_id', submitterUserId)
        .maybeSingle()
      const isApproved = (prof as any)?.status === 'approved'
      let isPaying = false
      if (!isApproved) {
        const { data: sub } = await supabase
          .from('subscriptions')
          .select('id,status,current_period_end,product_id')
          .eq('user_id', submitterUserId)
          .eq('product_id', 'verified_organizer')
          .maybeSingle()
        const s: any = sub
        if (s) {
          const activeLike = s.status === 'active' || s.status === 'trialing'
          const endsInFuture = !s.current_period_end || new Date(s.current_period_end) > new Date()
          const canceledButValid = s.status === 'canceled' && s.current_period_end && new Date(s.current_period_end) > new Date()
          isPaying = (activeLike && endsInFuture) || !!canceledButValid
        }
      }
      if (!isApproved && !isPaying) {
        return new Response(
          JSON.stringify({ success: false, reason: 'organizer_not_verified' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
      const creatorEmail = (prof as any)?.contact_email ?? null
      if (!creatorEmail) {
        return new Response(
          JSON.stringify({ success: false, reason: 'no_creator_email' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
      recipientEmail = creatorEmail
      templateData = {
        eventTitle: (ev as any).title,
        startAt: formatInDioceseZone((ev as any).start_at, (ev as any).diocese_slug),
        interestedEmail,
      }

    } else if (templateName === 'organizer-new-follower') {
      const organizerUserId = (templateData as any)?.organizerUserId
      const followerEmailRaw = (templateData as any)?.followerEmail
      if (typeof organizerUserId !== 'string' || typeof followerEmailRaw !== 'string') {
        return new Response(
          JSON.stringify({ error: 'organizerUserId and followerEmail required in templateData' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
      const followerEmail = followerEmailRaw.toLowerCase()
      // Confirm the follow row actually exists — never let arbitrary callers
      // spam an organizer with fake "new follower" notifications.
      const { data: followRow } = await supabase
        .from('organizer_follows')
        .select('id')
        .eq('organizer_user_id', organizerUserId)
        .eq('follower_email', followerEmail)
        .maybeSingle()
      if (!followRow) {
        return new Response(
          JSON.stringify({ error: 'follow record not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
      const { data: prof } = await supabase
        .from('organizer_profiles')
        .select('org_name,contact_email')
        .eq('user_id', organizerUserId)
        .maybeSingle()
      const organizerEmail = (prof as any)?.contact_email
      if (!organizerEmail) {
        return new Response(
          JSON.stringify({ success: false, reason: 'no_organizer_email' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
      recipientEmail = organizerEmail
      templateData = {
        orgName: (prof as any)?.org_name || 'your organization',
        followerEmail,
      }
    } else if (templateName === 'admin-organizer-applied' || templateName === 'organizer-application-received') {
      const organizerUserId = (templateData as any)?.organizerUserId
      if (typeof organizerUserId !== 'string') {
        return new Response(
          JSON.stringify({ error: 'organizerUserId required in templateData' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
      const { data: prof } = await supabase
        .from('organizer_profiles')
        .select('org_name,parish,contact_email,contact_phone,representative_name,address')
        .eq('user_id', organizerUserId)
        .maybeSingle()
      if (!prof) {
        return new Response(
          JSON.stringify({ error: 'organizer profile not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
      if (templateName === 'admin-organizer-applied') {
        recipientEmail = ADMIN_EMAIL
        templateData = {
          orgName: (prof as any).org_name || 'Unnamed organization',
          parish: (prof as any).parish || '',
          contactEmail: (prof as any).contact_email || '',
          contactPhone: (prof as any).contact_phone || '',
          representativeName: (prof as any).representative_name || '',
          address: (prof as any).address || '',
          adminUrl: 'https://thecatholiccalendar.org/catholic-calendar/admin',
        }
      } else {
        if (!(prof as any).contact_email) {
          return new Response(
            JSON.stringify({ success: false, reason: 'no_contact_email' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          )
        }
        recipientEmail = (prof as any).contact_email
        templateData = {
          orgName: (prof as any).org_name || 'your organization',
          representativeName: (prof as any).representative_name || '',
          locale: requestedLocale,
        }
      }
    } else if (templateName === 'admin-event-submitted' || templateName === 'event-submission-received') {
      const eventId = (templateData as any)?.eventId
      const fallbackTitle = typeof (templateData as any)?.title === 'string' ? (templateData as any).title.trim() : ''
      const fallbackEmail = (
        templateName === 'admin-event-submitted'
          ? (templateData as any)?.submitterEmail
          : recipientEmail
      )
      const fallbackSubmitterEmail = typeof fallbackEmail === 'string' ? fallbackEmail.trim().toLowerCase() : ''

      let eventQuery = supabase
        .from('calendar_events')
        .select('id,title,category,category_other,description,start_at,venue_name,address,guest_name,guest_email,submitted_by_user_id,is_featured,status,diocese_slug')

      if (typeof eventId === 'string') {
        eventQuery = eventQuery.eq('id', eventId)
      } else if (fallbackTitle && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fallbackSubmitterEmail)) {
        eventQuery = eventQuery
          .eq('title', fallbackTitle)
          .eq('guest_email', fallbackSubmitterEmail)
          .order('created_at', { ascending: false })
          .limit(1)
      } else {
        return new Response(
          JSON.stringify({ error: 'eventId or matching submission details required in templateData' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      const { data: ev } = await eventQuery.maybeSingle()

      if (!ev) {
        return new Response(
          JSON.stringify({ error: 'event not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      const event = ev as any
      const title = event.title || 'Untitled event'
      const emailLocale = templateName === 'event-submission-received' ? requestedLocale : 'en'
      const startAt = event.start_at
        ? formatInDioceseZone(event.start_at, event.diocese_slug, localeTag(emailLocale))
        : ''
      const venue = [event.venue_name, event.address].filter(Boolean).join(' — ')
      let submitterEmail = typeof event.guest_email === 'string' ? event.guest_email.trim().toLowerCase() : ''
      let submitterName = event.guest_name || 'Organizer'
      let isVerified = false

      if (event.submitted_by_user_id) {
        const { data: prof } = await supabase
          .from('organizer_profiles')
          .select('status,contact_email,org_name,representative_name')
          .eq('user_id', event.submitted_by_user_id)
          .maybeSingle()
        isVerified = (prof as any)?.status === 'approved'

        // Fall back to the organizer's profile contact when the form didn't
        // carry a contact email, so the submitter always gets their email.
        if (!submitterEmail && typeof (prof as any)?.contact_email === 'string') {
          submitterEmail = (prof as any).contact_email.trim().toLowerCase()
        }
        if (!event.guest_name) {
          submitterName = (prof as any)?.representative_name || (prof as any)?.org_name || submitterName
        }

        if (!isVerified) {
          const { data: sub } = await supabase
            .from('subscriptions')
            .select('status,current_period_end,product_id')
            .eq('user_id', event.submitted_by_user_id)
            .eq('product_id', 'verified_organizer')
            .maybeSingle()
          const s: any = sub
          if (s) {
            const activeLike = s.status === 'active' || s.status === 'trialing'
            const endsInFuture = !s.current_period_end || new Date(s.current_period_end) > new Date()
            const canceledButValid = s.status === 'canceled' && s.current_period_end && new Date(s.current_period_end) > new Date()
            isVerified = (activeLike && endsInFuture) || !!canceledButValid
          }
        }
      }

      if (templateName === 'admin-event-submitted') {
        recipientEmail = ADMIN_EMAIL
        templateData = {
          title,
          category: event.category === 'other' && event.category_other ? event.category_other : event.category,
          startAt,
          venue,
          description: event.description || '',
          submittedBy: submitterName,
          submitterEmail,
          isFeatured: Boolean(event.is_featured && isVerified),
          isVerified,
          adminUrl: 'https://thecatholiccalendar.org/catholic-calendar/admin',
        }
      } else {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submitterEmail)) {
          return new Response(
            JSON.stringify({ success: false, reason: 'no_submitter_email' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          )
        }
        recipientEmail = submitterEmail
        if (event.status === 'approved') {
          // Auto-approved (verified organizer) submissions go live immediately —
          // send only the "your event is published" email, never a
          // "we received it" email. Pending events get the review email.
          templateName = 'event-approved'
          template = TEMPLATES[templateName]
          templateData = {
            title,
            startAt,
            venue,
            eventUrl: event.id
              ? `https://thecatholiccalendar.org/catholic-calendar/event/${event.id}`
              : 'https://thecatholiccalendar.org/catholic-calendar',
            recipientName: submitterName,
          }
        } else {
          templateData = {
            submitterName,
            title,
            startAt,
            venue,
            calendarUrl: 'https://thecatholiccalendar.org/catholic-calendar',
            locale: requestedLocale,
            isVerified,
          }
        }
      }
    }
  }

  // Resolve effective recipient: template-level `to` takes precedence over
  // the (now possibly server-derived) recipientEmail.
  const effectiveRecipient = template.to || recipientEmail

  if (!effectiveRecipient) {
    return new Response(
      JSON.stringify({
        error: 'recipientEmail is required (unless the template defines a fixed recipient)',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }




  // 2. Check suppression list (fail-closed: if we can't verify, don't send)
  const { data: suppressed, error: suppressionError } = await supabase
    .from('suppressed_emails')
    .select('id')
    .eq('email', effectiveRecipient.toLowerCase())
    .maybeSingle()

  if (suppressionError) {
    console.error('Suppression check failed — refusing to send', {
      error: suppressionError,
      effectiveRecipient,
    })
    return new Response(
      JSON.stringify({ error: 'Failed to verify suppression status' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  if (suppressed) {
    // Log the suppressed attempt
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'suppressed',
    })

    console.log('Email suppressed', { effectiveRecipient, templateName })
    return new Response(
      JSON.stringify({ success: false, reason: 'email_suppressed' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // 3. Get or create unsubscribe token (one token per email address)
  const normalizedEmail = effectiveRecipient.toLowerCase()
  let unsubscribeToken: string

  // Check for existing token for this email
  const { data: existingToken, error: tokenLookupError } = await supabase
    .from('email_unsubscribe_tokens')
    .select('token, used_at')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (tokenLookupError) {
    console.error('Token lookup failed', {
      error: tokenLookupError,
      email: normalizedEmail,
    })
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'failed',
      error_message: 'Failed to look up unsubscribe token',
    })
    return new Response(
      JSON.stringify({ error: 'Failed to prepare email' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  if (existingToken && !existingToken.used_at) {
    // Reuse existing unused token
    unsubscribeToken = existingToken.token
  } else if (!existingToken) {
    // Create new token — upsert handles concurrent inserts gracefully
    unsubscribeToken = generateToken()
    const { error: tokenError } = await supabase
      .from('email_unsubscribe_tokens')
      .upsert(
        { token: unsubscribeToken, email: normalizedEmail },
        { onConflict: 'email', ignoreDuplicates: true }
      )

    if (tokenError) {
      console.error('Failed to create unsubscribe token', {
        error: tokenError,
      })
      await supabase.from('email_send_log').insert({
        message_id: messageId,
        template_name: templateName,
        recipient_email: effectiveRecipient,
        status: 'failed',
        error_message: 'Failed to create unsubscribe token',
      })
      return new Response(
        JSON.stringify({ error: 'Failed to prepare email' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // If another request raced us, our upsert was silently ignored.
    // Re-read to get the actual stored token.
    const { data: storedToken, error: reReadError } = await supabase
      .from('email_unsubscribe_tokens')
      .select('token')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (reReadError || !storedToken) {
      console.error('Failed to read back unsubscribe token after upsert', {
        error: reReadError,
        email: normalizedEmail,
      })
      await supabase.from('email_send_log').insert({
        message_id: messageId,
        template_name: templateName,
        recipient_email: effectiveRecipient,
        status: 'failed',
        error_message: 'Failed to confirm unsubscribe token storage',
      })
      return new Response(
        JSON.stringify({ error: 'Failed to prepare email' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }
    unsubscribeToken = storedToken.token
  } else {
    // Token exists but is already used — email should have been caught by suppression check above.
    // This is a safety fallback; log and skip sending.
    console.warn('Unsubscribe token already used but email not suppressed', {
      email: normalizedEmail,
    })
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'suppressed',
      error_message:
        'Unsubscribe token used but email missing from suppressed list',
    })
    return new Response(
      JSON.stringify({ success: false, reason: 'email_suppressed' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // 4. Render React Email template to HTML and plain text
  const html = await renderAsync(
    React.createElement(template.component, templateData)
  )
  const plainText = await renderAsync(
    React.createElement(template.component, templateData),
    { plainText: true }
  )

  // Resolve subject — supports static string or dynamic function
  const resolvedSubject =
    typeof template.subject === 'function'
      ? template.subject(templateData)
      : template.subject

  // 5. Enqueue the pre-rendered email for async processing by the dispatcher.
  // The dispatcher (process-email-queue) handles sending, retries, and rate-limit backoff.

  // Log pending BEFORE enqueue so we have a record even if enqueue crashes
  await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name: templateName,
    recipient_email: effectiveRecipient,
    status: 'pending',
  })

  const { error: enqueueError } = await supabase.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      message_id: messageId,
      to: effectiveRecipient,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject: resolvedSubject,
      html,
      text: plainText,
      purpose: 'transactional',
      label: templateName,
      idempotency_key: idempotencyKey,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  })

  if (enqueueError) {
    console.error('Failed to enqueue email', {
      error: enqueueError,
      templateName,
      effectiveRecipient,
    })

    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'failed',
      error_message: 'Failed to enqueue email',
    })

    return new Response(JSON.stringify({ error: 'Failed to enqueue email' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  console.log('Transactional email enqueued', { templateName, effectiveRecipient })

  return new Response(
    JSON.stringify({ success: true, queued: true }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )
})
