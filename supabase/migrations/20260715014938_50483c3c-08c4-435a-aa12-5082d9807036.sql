
-- Revoke broad column access from anon/authenticated; re-grant only non-PII columns
REVOKE ALL ON public.calendar_events FROM anon;
REVOKE ALL ON public.calendar_events FROM authenticated;

-- Anon: read-only on non-PII columns (RLS still restricts to approved rows)
GRANT SELECT (
  id, title, description, start_at, end_at, all_day, category, venue_name,
  address, latitude, longitude, parish, is_free, price_note, registration_url,
  submitted_by_user_id, status, rejection_reason, created_at, updated_at,
  is_featured, category_other, poster_url
) ON public.calendar_events TO anon;

-- Anon can submit events (RLS "Anyone can submit an event" policy governs this)
GRANT INSERT ON public.calendar_events TO anon;

-- Authenticated: read non-PII columns; full write (RLS restricts rows)
GRANT SELECT (
  id, title, description, start_at, end_at, all_day, category, venue_name,
  address, latitude, longitude, parish, is_free, price_note, registration_url,
  submitted_by_user_id, status, rejection_reason, created_at, updated_at,
  is_featured, category_other, poster_url
) ON public.calendar_events TO authenticated;

GRANT INSERT, UPDATE, DELETE ON public.calendar_events TO authenticated;

-- Ensure service_role keeps full access (edge functions, admin RPCs)
GRANT ALL ON public.calendar_events TO service_role;

-- Rebuild the public view without guest_name (guest_email was already excluded)
DROP VIEW IF EXISTS public.calendar_events_public;
CREATE VIEW public.calendar_events_public
WITH (security_invoker = on) AS
SELECT
  id, title, description, category, category_other, start_at, end_at, all_day,
  venue_name, address, latitude, longitude, parish, is_free, price_note,
  registration_url, submitted_by_user_id, status, created_at, updated_at,
  is_featured, poster_url
FROM public.calendar_events
WHERE status = 'approved'::public.event_status;

GRANT SELECT ON public.calendar_events_public TO anon, authenticated;
