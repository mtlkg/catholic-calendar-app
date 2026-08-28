REVOKE EXECUTE ON FUNCTION public.dm_group_role_of(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_dm_group_manager(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_dm_group_owner(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dm_group_role_of(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_dm_group_manager(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_dm_group_owner(uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.log_dm_group_member_event() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_dm_group_lifecycle() FROM PUBLIC, anon, authenticated;