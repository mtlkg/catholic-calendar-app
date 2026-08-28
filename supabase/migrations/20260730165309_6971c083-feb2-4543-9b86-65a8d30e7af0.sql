-- Remove broad full-row public read access to organizer_profiles (exposes PII)
DROP POLICY IF EXISTS "Approved organizer profiles are readable to anon" ON public.organizer_profiles;
DROP POLICY IF EXISTS "Approved organizer profiles are readable to authenticated" ON public.organizer_profiles;

REVOKE SELECT ON public.organizer_profiles FROM anon;

-- Public-safe view exposing only non-PII columns of approved organizers.
CREATE OR REPLACE VIEW public.organizer_profiles_public
WITH (security_invoker = false) AS
SELECT id, user_id, org_name, parish, description, categories,
       website_url, logo_url, status, created_at, updated_at
FROM public.organizer_profiles
WHERE status = 'approved'::organizer_status;

GRANT SELECT ON public.organizer_profiles_public TO anon, authenticated;
