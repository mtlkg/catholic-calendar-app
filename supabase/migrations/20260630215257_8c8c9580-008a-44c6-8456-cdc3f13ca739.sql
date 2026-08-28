
-- Allow anonymous (logged-out) visitors to see approved organizer profiles.
-- The public-facing view (organizer_profiles_public) already excludes contact
-- info — it only exposes name, parish, description, categories, website, logo.
CREATE POLICY "Approved organizer profiles are readable to anon"
ON public.organizer_profiles
FOR SELECT
TO anon
USING (status = 'approved'::organizer_status);

-- Column-level grant so the security_invoker view can read just the safe columns
-- for anonymous visitors.
GRANT SELECT (
  id, user_id, org_name, parish, description, categories,
  website_url, logo_url, status, created_at, updated_at
) ON public.organizer_profiles TO anon;
