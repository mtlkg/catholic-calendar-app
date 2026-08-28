
-- Recreate views with security_invoker=true so they don't bypass RLS
DROP VIEW IF EXISTS public.calendar_events_public;
DROP VIEW IF EXISTS public.organizer_profiles_public;

CREATE VIEW public.calendar_events_public
WITH (security_invoker = true) AS
SELECT id, title, description, category, category_other, start_at, end_at, all_day,
       venue_name, address, latitude, longitude, parish, is_free, price_note,
       registration_url, submitted_by_user_id, guest_name, status,
       created_at, updated_at, is_featured
FROM public.calendar_events
WHERE status = 'approved';

GRANT SELECT ON public.calendar_events_public TO anon, authenticated;

CREATE VIEW public.organizer_profiles_public
WITH (security_invoker = true) AS
SELECT id, user_id, org_name, parish, description, categories,
       website_url, logo_url, status, created_at, updated_at
FROM public.organizer_profiles
WHERE status = 'approved';

GRANT SELECT ON public.organizer_profiles_public TO anon, authenticated;

-- Re-add SELECT policies on base tables so the invoker-mode views can read approved rows
CREATE POLICY "Approved events are readable"
  ON public.calendar_events
  FOR SELECT
  TO anon, authenticated
  USING (status = 'approved');

CREATE POLICY "Approved organizer profiles are readable"
  ON public.organizer_profiles
  FOR SELECT
  TO anon, authenticated
  USING (status = 'approved');

-- Hide sensitive columns from unauthenticated users on the base tables
REVOKE SELECT (guest_email, rejection_reason) ON public.calendar_events FROM anon;
REVOKE SELECT (contact_email, contact_phone) ON public.organizer_profiles FROM anon;
