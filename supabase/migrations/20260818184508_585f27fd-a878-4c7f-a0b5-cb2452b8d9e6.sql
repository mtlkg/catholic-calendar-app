CREATE OR REPLACE FUNCTION public.upsert_my_organizer_profile(_patch jsonb)
RETURNS SETOF public.organizer_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  INSERT INTO public.organizer_profiles (
    user_id, org_name, parish, description, categories, categories_other,
    contact_email, contact_phone, representative_name, address, diocese_slug,
    website_url, logo_url
  )
  VALUES (
    uid,
    NULLIF(_patch->>'org_name',''),
    NULLIF(_patch->>'parish',''),
    NULLIF(_patch->>'description',''),
    COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(_patch->'categories','[]'::jsonb)) AS x), ARRAY[]::text[]),
    NULLIF(_patch->>'categories_other',''),
    NULLIF(_patch->>'contact_email',''),
    NULLIF(_patch->>'contact_phone',''),
    NULLIF(_patch->>'representative_name',''),
    NULLIF(_patch->>'address',''),
    NULLIF(_patch->>'diocese_slug',''),
    NULLIF(_patch->>'website_url',''),
    NULLIF(_patch->>'logo_url','')
  )
  ON CONFLICT (user_id) DO UPDATE SET
    org_name = EXCLUDED.org_name,
    parish = EXCLUDED.parish,
    description = EXCLUDED.description,
    categories = EXCLUDED.categories,
    categories_other = EXCLUDED.categories_other,
    contact_email = EXCLUDED.contact_email,
    contact_phone = EXCLUDED.contact_phone,
    representative_name = EXCLUDED.representative_name,
    address = EXCLUDED.address,
    diocese_slug = EXCLUDED.diocese_slug,
    website_url = EXCLUDED.website_url,
    logo_url = EXCLUDED.logo_url,
    updated_at = now();

  RETURN QUERY SELECT * FROM public.organizer_profiles WHERE user_id = uid;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_my_organizer_profile(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_my_organizer_profile(jsonb) TO authenticated, service_role;