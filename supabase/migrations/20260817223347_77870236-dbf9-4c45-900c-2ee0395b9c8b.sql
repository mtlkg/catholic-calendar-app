CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  d text := NULLIF(m->>'diocese_slug', '');
BEGIN
  IF d IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.dioceses WHERE slug = d) THEN
    d := NULL;
  END IF;

  INSERT INTO public.organizer_profiles (
    user_id, contact_email, org_name, parish, contact_phone,
    representative_name, address, website_url, description, diocese_slug
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
    NULLIF(m->>'description', ''),
    d
  )
  ON CONFLICT (user_id) DO UPDATE SET
    org_name = COALESCE(public.organizer_profiles.org_name, EXCLUDED.org_name),
    parish = COALESCE(public.organizer_profiles.parish, EXCLUDED.parish),
    contact_phone = COALESCE(public.organizer_profiles.contact_phone, EXCLUDED.contact_phone),
    representative_name = COALESCE(public.organizer_profiles.representative_name, EXCLUDED.representative_name),
    address = COALESCE(public.organizer_profiles.address, EXCLUDED.address),
    website_url = COALESCE(public.organizer_profiles.website_url, EXCLUDED.website_url),
    description = COALESCE(public.organizer_profiles.description, EXCLUDED.description),
    diocese_slug = COALESCE(public.organizer_profiles.diocese_slug, EXCLUDED.diocese_slug);
  RETURN NEW;
END;
$$;

UPDATE public.organizer_profiles p
SET diocese_slug = 'edmonton'
WHERE p.diocese_slug IS NULL
  AND p.org_name = 'John Wick Inc';