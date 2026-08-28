
-- 1) Recreate public views as security_invoker (fixes SUPA_security_definer_view)
DROP VIEW IF EXISTS public.calendar_events_public;
CREATE VIEW public.calendar_events_public
WITH (security_invoker = true) AS
SELECT
  id, title, description, category, category_other,
  start_at, end_at, all_day,
  venue_name, address, latitude, longitude, parish,
  is_free, price_note, registration_url,
  submitted_by_user_id, guest_name,
  status, created_at, updated_at, is_featured, poster_url
FROM public.calendar_events
WHERE status = 'approved';
GRANT SELECT ON public.calendar_events_public TO anon, authenticated;

DROP VIEW IF EXISTS public.organizer_profiles_public;
CREATE VIEW public.organizer_profiles_public
WITH (security_invoker = true) AS
SELECT
  id, user_id, org_name, parish, description, categories,
  website_url, logo_url, status, created_at, updated_at
FROM public.organizer_profiles
WHERE status = 'approved';
GRANT SELECT ON public.organizer_profiles_public TO anon, authenticated;

-- 2) Column-level grants on calendar_events: hide guest_email and rejection_reason
--    from anon/authenticated. service_role retains full access for edge functions.
REVOKE SELECT ON public.calendar_events FROM anon, authenticated;
GRANT SELECT (
  id, title, description, start_at, end_at, all_day, category, category_other,
  venue_name, address, latitude, longitude, parish,
  is_free, price_note, registration_url,
  submitted_by_user_id, guest_name,
  status, created_at, updated_at, is_featured, poster_url
) ON public.calendar_events TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.calendar_events TO authenticated;
GRANT ALL ON public.calendar_events TO service_role;

-- 3) SECURITY DEFINER helpers so admins and owners can still read the sensitive
--    columns through controlled server-side functions.
CREATE OR REPLACE FUNCTION public.admin_list_events(_status text DEFAULT NULL)
RETURNS SETOF public.calendar_events
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
    SELECT * FROM public.calendar_events
    WHERE (_status IS NULL OR status::text = _status)
    ORDER BY created_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_events(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_events(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.my_events()
RETURNS SETOF public.calendar_events
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.calendar_events
  WHERE submitted_by_user_id = auth.uid()
  ORDER BY start_at DESC;
$$;
REVOKE ALL ON FUNCTION public.my_events() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_events() TO authenticated;

-- 4) Tighten event-posters storage uploads (no more anonymous uploads).
DROP POLICY IF EXISTS "Anyone can upload event posters" ON storage.objects;
CREATE POLICY "Authenticated users upload own event posters"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'event-posters'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
