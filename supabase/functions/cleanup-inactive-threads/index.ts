import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

function isServiceRole(req: Request): boolean {
  const auth = req.headers.get('Authorization') || req.headers.get('authorization') || ''
  if (!auth.startsWith('Bearer ')) return false
  try {
    const [, payload] = auth.slice(7).split('.')
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/') +
      '=='.slice(0, (4 - (payload.length % 4)) % 4)
    return JSON.parse(atob(b64)).role === 'service_role'
  } catch { return false }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  if (!isServiceRole(req)) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Find threads where the most recent activity (thread updated_at OR latest reply created_at)
  // is older than 60 days. Skip pinned threads.
  const cutoffIso = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()

  const { data: threads, error } = await supabase
    .from('discussion_threads')
    .select('id, title, author_user_id, updated_at, pinned, discussion_replies(created_at)')
    .eq('pinned', false)
    .lt('updated_at', cutoffIso)

  if (error) {
    console.error('Failed to list threads', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const expired = (threads ?? []).filter((t: any) => {
    const replyTimes = (t.discussion_replies ?? []).map((r: any) => new Date(r.created_at).getTime())
    const lastReply = replyTimes.length ? Math.max(...replyTimes) : 0
    const lastActivity = Math.max(new Date(t.updated_at).getTime(), lastReply)
    return lastActivity < new Date(cutoffIso).getTime()
  })

  let deleted = 0
  let notified = 0

  for (const t of expired) {
    // Look up author email + name
    const { data: profile } = await supabase
      .from('organizer_profiles')
      .select('contact_email, representative_name, org_name')
      .eq('user_id', (t as any).author_user_id)
      .maybeSingle()

    let email: string | null = profile?.contact_email ?? null
    if (!email) {
      const { data: u } = await supabase.auth.admin.getUserById((t as any).author_user_id)
      email = u?.user?.email ?? null
    }

    // Delete first (cascades replies)
    const { error: delErr } = await supabase
      .from('discussion_threads')
      .delete()
      .eq('id', (t as any).id)

    if (delErr) {
      console.error('Failed to delete thread', (t as any).id, delErr)
      continue
    }
    deleted++

    if (email) {
      const { error: mailErr } = await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'thread-expired',
          recipientEmail: email,
          idempotencyKey: `thread-expired-${(t as any).id}`,
          templateData: {
            title: (t as any).title,
            recipientName: profile?.representative_name || profile?.org_name || '',
            discussionsUrl: 'https://thecatholiccalendar.org/catholic-calendar/dashboard',
          },
        },
      })
      if (mailErr) console.error('Failed to send expiry email', mailErr)
      else notified++
    }
  }

  return new Response(JSON.stringify({ deleted, notified }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
