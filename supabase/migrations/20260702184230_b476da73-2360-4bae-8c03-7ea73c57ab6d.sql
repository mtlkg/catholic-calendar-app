
-- Restore public read access via sanitized views (security_invoker=on requires
-- anon to have both RLS SELECT and column-level SELECT on base tables).

-- Calendar events: anon can read approved events, but only the safe columns
-- exposed by calendar_events_public.
CREATE POLICY "Approved events are readable to anon"
  ON public.calendar_events FOR SELECT
  TO anon
  USING (status = 'approved'::event_status);

GRANT SELECT (
  id, title, description, category, start_at, end_at,
  venue_name, address, parish, guest_name, registration_url,
  is_featured, latitude, longitude, submitted_by_user_id, status
) ON public.calendar_events TO anon;

-- Organizer profiles: anon can read approved organizers, only safe columns.
CREATE POLICY "Approved organizer profiles are readable to anon"
  ON public.organizer_profiles FOR SELECT
  TO anon
  USING (status = 'approved'::organizer_status);

GRANT SELECT (
  id, user_id, org_name, parish, description, categories,
  website_url, logo_url, status
) ON public.organizer_profiles TO anon;
