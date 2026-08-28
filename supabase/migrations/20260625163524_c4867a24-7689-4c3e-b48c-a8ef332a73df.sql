CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.organizer_profiles (user_id, contact_email, org_name)
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(COALESCE(NEW.raw_user_meta_data->>'org_name', NEW.raw_user_meta_data->>'full_name'), '')
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$function$;

UPDATE public.organizer_profiles
SET org_name = NULL
WHERE org_name IS NOT NULL
  AND (org_name = contact_email OR org_name LIKE '%@%');