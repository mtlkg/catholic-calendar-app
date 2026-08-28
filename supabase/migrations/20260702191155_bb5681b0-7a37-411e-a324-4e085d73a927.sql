
REVOKE SELECT (contact_email, contact_phone, address)
  ON public.organizer_profiles FROM authenticated;

CREATE OR REPLACE FUNCTION public.get_my_organizer_profile()
RETURNS SETOF public.organizer_profiles
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT * FROM public.organizer_profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_organizer_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_organizer_profile() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_organizer_profiles()
RETURNS SETOF public.organizer_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  RETURN QUERY SELECT * FROM public.organizer_profiles ORDER BY created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_organizer_profiles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_organizer_profiles() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_organizer_contacts(_user_ids uuid[])
RETURNS TABLE (
  user_id uuid,
  org_name text,
  contact_email text,
  contact_phone text,
  address text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  RETURN QUERY
    SELECT p.user_id, p.org_name, p.contact_email, p.contact_phone, p.address
    FROM public.organizer_profiles p
    WHERE p.user_id = ANY(_user_ids);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_get_organizer_contacts(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_organizer_contacts(uuid[]) TO authenticated;
