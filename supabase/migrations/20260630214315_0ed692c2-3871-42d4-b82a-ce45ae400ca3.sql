
REVOKE EXECUTE ON FUNCTION public.release_stale_featured_slots() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_stale_featured_slots() TO service_role, postgres;
