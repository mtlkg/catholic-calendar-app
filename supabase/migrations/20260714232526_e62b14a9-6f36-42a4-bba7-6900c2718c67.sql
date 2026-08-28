REVOKE EXECUTE ON FUNCTION public.is_paying_verified(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_paying_verified(uuid) TO service_role;