CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  m jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
BEGIN
  INSERT INTO public.organizer_profiles (
    user_id, contact_email, org_name, parish, contact_phone,
    representative_name, address, website_url, description
  )
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(COALESCE(m->>'org_name', m->>'full_name'), ''),
    NULLIF(m->>'parish', ''),
    NULLIF(m->>'contact_phone', ''),
    NULLIF(m->>'representative_name', ''),
    NULLIF(m->>'address', ''),
    NULLIF(m->>'website_url', ''),
    NULLIF(m->>'description', '')
  )
  ON CONFLICT (user_id) DO UPDATE SET
    org_name = COALESCE(public.organizer_profiles.org_name, EXCLUDED.org_name),
    parish = COALESCE(public.organizer_profiles.parish, EXCLUDED.parish),
    contact_phone = COALESCE(public.organizer_profiles.contact_phone, EXCLUDED.contact_phone),
    representative_name = COALESCE(public.organizer_profiles.representative_name, EXCLUDED.representative_name),
    address = COALESCE(public.organizer_profiles.address, EXCLUDED.address),
    website_url = COALESCE(public.organizer_profiles.website_url, EXCLUDED.website_url),
    description = COALESCE(public.organizer_profiles.description, EXCLUDED.description);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();