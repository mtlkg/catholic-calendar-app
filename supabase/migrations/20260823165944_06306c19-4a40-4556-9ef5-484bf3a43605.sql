-- The sync_event_language function is only meant to run inside a trigger.
REVOKE EXECUTE ON FUNCTION public.sync_event_language() FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_event_language() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sync_event_language() TO service_role;