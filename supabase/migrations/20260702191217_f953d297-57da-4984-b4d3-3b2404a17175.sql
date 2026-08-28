
-- Move implementations to private schema
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.get_my_organizer_profile()
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

CREATE OR REPLACE FUNCTION private.admin_list_organizer_profiles()
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

CREATE OR REPLACE FUNCTION private.admin_get_organizer_contacts(_user_ids uuid[])
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

-- Replace public functions with SECURITY INVOKER wrappers
DROP FUNCTION IF EXISTS public.get_my_organizer_profile();
DROP FUNCTION IF EXISTS public.admin_list_organizer_profiles();
DROP FUNCTION IF EXISTS public.admin_get_organizer_contacts(uuid[]);

CREATE OR REPLACE FUNCTION public.get_my_organizer_profile()
RETURNS SETOF public.organizer_profiles
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
STABLE
AS $$
  SELECT * FROM private.get_my_organizer_profile();
$$;

CREATE OR REPLACE FUNCTION public.admin_list_organizer_profiles()
RETURNS SETOF public.organizer_profiles
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
STABLE
AS $$
  SELECT * FROM private.admin_list_organizer_profiles();
$$;

CREATE OR REPLACE FUNCTION public.admin_get_organizer_contacts(_user_ids uuid[])
RETURNS TABLE (
  user_id uuid,
  org_name text,
  contact_email text,
  contact_phone text,
  address text
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
STABLE
AS $$
  SELECT * FROM private.admin_get_organizer_contacts(_user_ids);
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_organizer_profile() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_organizer_profiles() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_organizer_contacts(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_organizer_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_organizer_profiles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_organizer_contacts(uuid[]) TO authenticated;

REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
