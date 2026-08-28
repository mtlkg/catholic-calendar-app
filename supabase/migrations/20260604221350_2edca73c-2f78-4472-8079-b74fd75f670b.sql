ALTER TABLE public.dinner_rsvps
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'paid',
  ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;

GRANT SELECT, UPDATE ON public.dinner_rsvps TO service_role;

CREATE POLICY "Service role can select dinner rsvps"
  ON public.dinner_rsvps FOR SELECT TO service_role USING (true);

CREATE POLICY "Service role can update dinner rsvps"
  ON public.dinner_rsvps FOR UPDATE TO service_role USING (true);