GRANT EXECUTE ON FUNCTION public.is_dm_group_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_dm_group_manager(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_dm_group_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dm_group_role_of(uuid, uuid) TO authenticated;