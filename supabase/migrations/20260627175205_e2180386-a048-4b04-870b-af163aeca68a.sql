
-- Trigger to create organizer_profiles row on new signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill any auth users missing an organizer_profile
INSERT INTO public.organizer_profiles (user_id, contact_email, org_name)
SELECT u.id, u.email, NULLIF(COALESCE(u.raw_user_meta_data->>'org_name', u.raw_user_meta_data->>'full_name'), '')
FROM auth.users u
LEFT JOIN public.organizer_profiles op ON op.user_id = u.id
WHERE op.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;
