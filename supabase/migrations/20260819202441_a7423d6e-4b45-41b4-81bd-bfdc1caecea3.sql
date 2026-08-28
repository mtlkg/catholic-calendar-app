CREATE TABLE IF NOT EXISTS public.notification_digest_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  channel text NOT NULL,
  kind text NOT NULL,
  pending_count integer NOT NULL DEFAULT 0,
  last_emailed_at timestamptz,
  last_excerpt text,
  last_sender_name text,
  last_thread_title text,
  last_url text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, channel)
);

GRANT SELECT ON public.notification_digest_state TO authenticated;
GRANT ALL ON public.notification_digest_state TO service_role;

ALTER TABLE public.notification_digest_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own digest state"
  ON public.notification_digest_state FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_notification_digest_pending
  ON public.notification_digest_state (pending_count, last_emailed_at)
  WHERE pending_count > 0;

ALTER TABLE public.notification_prefs
  ADD COLUMN IF NOT EXISTS email_dm_frequency text NOT NULL DEFAULT 'hourly',
  ADD COLUMN IF NOT EXISTS email_thread_reply_frequency text NOT NULL DEFAULT 'hourly';