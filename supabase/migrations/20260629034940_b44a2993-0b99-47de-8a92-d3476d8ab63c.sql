
-- Restrict public SELECT on calendar_events and organizer_profiles to authenticated users only.
-- Anonymous (public) reads must go through the safer *_public views, which omit sensitive columns.

DROP POLICY IF EXISTS "Approved events are readable" ON public.calendar_events;
CREATE POLICY "Approved events are readable to authenticated"
  ON public.calendar_events
  FOR SELECT
  TO authenticated
  USING (status = 'approved'::event_status);

DROP POLICY IF EXISTS "Approved organizer profiles are readable" ON public.organizer_profiles;
CREATE POLICY "Approved organizer profiles are readable to authenticated"
  ON public.organizer_profiles
  FOR SELECT
  TO authenticated
  USING (status = 'approved'::organizer_status);

REVOKE SELECT ON public.calendar_events FROM anon;
REVOKE SELECT ON public.organizer_profiles FROM anon;

-- Ensure the safe public views remain readable by anonymous visitors.
GRANT SELECT ON public.calendar_events_public TO anon, authenticated;
GRANT SELECT ON public.organizer_profiles_public TO anon, authenticated;
