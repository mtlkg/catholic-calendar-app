
-- 1) Remove anon SELECT policies on base tables (public access flows through sanitized views)
DROP POLICY IF EXISTS "Approved events are readable to anon" ON public.calendar_events;
DROP POLICY IF EXISTS "Approved organizer profiles are readable to anon" ON public.organizer_profiles;

-- 2) Lock down SECURITY DEFINER functions: revoke from PUBLIC/anon/authenticated, then re-grant only the user-facing ones.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated', r.proname, r.args);
  END LOOP;
END$$;

-- Re-grant EXECUTE for functions intentionally callable by signed-in users
GRANT EXECUTE ON FUNCTION public.admin_list_events(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_event(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_organizer(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_events() TO authenticated;
