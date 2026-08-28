
ALTER VIEW public.calendar_events_public SET (security_invoker = false);
GRANT SELECT ON public.calendar_events_public TO anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='organizer_profiles_public') THEN
    EXECUTE 'ALTER VIEW public.organizer_profiles_public SET (security_invoker = false)';
    EXECUTE 'GRANT SELECT ON public.organizer_profiles_public TO anon, authenticated';
  END IF;
END$$;
