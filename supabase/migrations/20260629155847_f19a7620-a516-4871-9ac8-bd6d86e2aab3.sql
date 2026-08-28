
-- 1. Add poster_url to events
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS poster_url text;

-- 2. Recreate the public view to include poster_url
DROP VIEW IF EXISTS public.calendar_events_public;
CREATE VIEW public.calendar_events_public AS
SELECT id, title, description, category, category_other, start_at, end_at, all_day,
       venue_name, address, latitude, longitude, parish, is_free, price_note,
       registration_url, submitted_by_user_id, guest_name, status, created_at,
       updated_at, is_featured, poster_url
FROM public.calendar_events
WHERE status = 'approved'::event_status;
GRANT SELECT ON public.calendar_events_public TO anon, authenticated;

-- 3. Event interest reminders table
CREATE TABLE IF NOT EXISTS public.event_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  email text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reminder_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, email)
);

GRANT SELECT, INSERT ON public.event_interests TO anon, authenticated;
GRANT ALL ON public.event_interests TO service_role;

ALTER TABLE public.event_interests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can register interest" ON public.event_interests
  FOR INSERT TO anon, authenticated
  WITH CHECK (email IS NOT NULL AND event_id IS NOT NULL);

CREATE POLICY "Admins can view interests" ON public.event_interests
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS event_interests_event_id_idx ON public.event_interests(event_id);
CREATE INDEX IF NOT EXISTS event_interests_pending_idx ON public.event_interests(event_id) WHERE reminder_sent_at IS NULL;
