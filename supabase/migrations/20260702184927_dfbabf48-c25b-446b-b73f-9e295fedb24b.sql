
-- Move the four user-exposed SECURITY DEFINER functions into the `private`
-- schema and expose SECURITY INVOKER wrappers in `public` (same pattern
-- already used for has_role / is_approved_organizer).

-- 1) Private SECURITY DEFINER implementations
CREATE OR REPLACE FUNCTION private.admin_list_events(_status text DEFAULT NULL)
RETURNS SETOF public.calendar_events
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
    SELECT * FROM public.calendar_events
    WHERE (_status IS NULL OR status::text = _status)
    ORDER BY created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION private.admin_update_event(_event_id uuid, _patch jsonb)
RETURNS public.calendar_events
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.calendar_events;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.calendar_events SET
    title            = COALESCE(_patch->>'title', title),
    description      = COALESCE(_patch->>'description', description),
    venue_name       = COALESCE(_patch->>'venue_name', venue_name),
    address          = COALESCE(_patch->>'address', address),
    start_at         = COALESCE((_patch->>'start_at')::timestamptz, start_at),
    end_at           = COALESCE((_patch->>'end_at')::timestamptz, end_at),
    poster_url       = COALESCE(_patch->>'poster_url', poster_url),
    registration_url = COALESCE(_patch->>'registration_url', registration_url),
    guest_email      = COALESCE(_patch->>'guest_email', guest_email),
    rejection_reason = COALESCE(_patch->>'rejection_reason', rejection_reason),
    status           = COALESCE((_patch->>'status')::event_status, status)
  WHERE id = _event_id
  RETURNING * INTO r;

  RETURN r;
END;
$$;

CREATE OR REPLACE FUNCTION private.admin_update_organizer(_user_id uuid, _patch jsonb)
RETURNS public.organizer_profiles
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.organizer_profiles;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.organizer_profiles SET
    org_name            = COALESCE(_patch->>'org_name', org_name),
    parish              = COALESCE(_patch->>'parish', parish),
    contact_email       = COALESCE(_patch->>'contact_email', contact_email),
    contact_phone       = COALESCE(_patch->>'contact_phone', contact_phone),
    representative_name = COALESCE(_patch->>'representative_name', representative_name),
    address             = COALESCE(_patch->>'address', address),
    website_url         = COALESCE(_patch->>'website_url', website_url),
    description         = COALESCE(_patch->>'description', description),
    logo_url            = COALESCE(_patch->>'logo_url', logo_url),
    status              = COALESCE((_patch->>'status')::organizer_status, status)
  WHERE user_id = _user_id
  RETURNING * INTO r;

  RETURN r;
END;
$$;

CREATE OR REPLACE FUNCTION private.my_events()
RETURNS SETOF public.calendar_events
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.calendar_events
  WHERE submitted_by_user_id = auth.uid()
  ORDER BY start_at DESC;
$$;

-- Lock down private definers (only authenticated + service_role need call)
REVOKE ALL ON FUNCTION private.admin_list_events(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.admin_update_event(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.admin_update_organizer(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.my_events() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION private.admin_list_events(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.admin_update_event(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.admin_update_organizer(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.my_events() TO authenticated, service_role;

-- 2) Replace public functions with SECURITY INVOKER wrappers
DROP FUNCTION IF EXISTS public.admin_list_events(text);
DROP FUNCTION IF EXISTS public.admin_update_event(uuid, jsonb);
DROP FUNCTION IF EXISTS public.admin_update_organizer(uuid, jsonb);
DROP FUNCTION IF EXISTS public.my_events();

CREATE FUNCTION public.admin_list_events(_status text DEFAULT NULL)
RETURNS SETOF public.calendar_events
LANGUAGE sql STABLE
SET search_path = public
AS $$ SELECT * FROM private.admin_list_events(_status) $$;

CREATE FUNCTION public.admin_update_event(_event_id uuid, _patch jsonb)
RETURNS public.calendar_events
LANGUAGE sql
SET search_path = public
AS $$ SELECT * FROM private.admin_update_event(_event_id, _patch) $$;

CREATE FUNCTION public.admin_update_organizer(_user_id uuid, _patch jsonb)
RETURNS public.organizer_profiles
LANGUAGE sql
SET search_path = public
AS $$ SELECT * FROM private.admin_update_organizer(_user_id, _patch) $$;

CREATE FUNCTION public.my_events()
RETURNS SETOF public.calendar_events
LANGUAGE sql STABLE
SET search_path = public
AS $$ SELECT * FROM private.my_events() $$;

-- Public wrappers: only authenticated needs EXECUTE (no anon, no PUBLIC)
REVOKE ALL ON FUNCTION public.admin_list_events(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_update_event(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_update_organizer(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.my_events() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_list_events(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_event(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_organizer(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.my_events() TO authenticated, service_role;
