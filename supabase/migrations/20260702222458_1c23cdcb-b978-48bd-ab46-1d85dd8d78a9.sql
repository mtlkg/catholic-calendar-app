GRANT USAGE ON SCHEMA private TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION private.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_approved_organizer(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.my_events() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.get_my_organizer_profile() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.admin_list_events(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.admin_list_organizer_profiles() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.admin_get_organizer_contacts(uuid[]) TO authenticated, service_role;

REVOKE USAGE ON SCHEMA private FROM anon;
REVOKE EXECUTE ON FUNCTION private.my_events() FROM anon;
REVOKE EXECUTE ON FUNCTION private.get_my_organizer_profile() FROM anon;
REVOKE EXECUTE ON FUNCTION private.admin_list_events(text) FROM anon;
REVOKE EXECUTE ON FUNCTION private.admin_list_organizer_profiles() FROM anon;
REVOKE EXECUTE ON FUNCTION private.admin_get_organizer_contacts(uuid[]) FROM anon;