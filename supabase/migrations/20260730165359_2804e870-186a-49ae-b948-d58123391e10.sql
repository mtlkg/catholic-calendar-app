-- View should respect the querying user's permissions
ALTER VIEW public.organizer_profiles_public SET (security_invoker = true);

-- Restore row visibility for approved organizers, but only for non-PII columns
CREATE POLICY "Approved organizer profiles are readable to anon"
ON public.organizer_profiles FOR SELECT TO anon
USING (status = 'approved'::organizer_status);

CREATE POLICY "Approved organizer profiles are readable to authenticated"
ON public.organizer_profiles FOR SELECT TO authenticated
USING (status = 'approved'::organizer_status);

-- Column-level SELECT grants: PII columns are not selectable by anon/authenticated
REVOKE SELECT ON public.organizer_profiles FROM anon, authenticated;

GRANT SELECT (id, user_id, org_name, parish, description, categories,
              website_url, logo_url, status, categories_other,
              created_at, updated_at)
ON public.organizer_profiles TO anon, authenticated;

GRANT SELECT ON public.organizer_profiles_public TO anon, authenticated;
