
-- Organizers can belong to multiple dioceses
ALTER TABLE public.organizer_profiles
  ADD COLUMN IF NOT EXISTS diocese_slugs text[] NOT NULL DEFAULT '{}';

UPDATE public.organizer_profiles
SET diocese_slugs = ARRAY[diocese_slug]
WHERE diocese_slug IS NOT NULL AND cardinality(diocese_slugs) = 0;

CREATE INDEX IF NOT EXISTS organizer_profiles_diocese_slugs_idx
  ON public.organizer_profiles USING gin (diocese_slugs);

-- Events can be broadcast to extra dioceses or nationwide
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS audience_diocese_slugs text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS audience_countries text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS audience_scope text NOT NULL DEFAULT 'diocese';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'calendar_events_audience_scope_chk'
  ) THEN
    ALTER TABLE public.calendar_events
      ADD CONSTRAINT calendar_events_audience_scope_chk
      CHECK (audience_scope IN ('diocese', 'multi', 'national'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS calendar_events_audience_dioceses_idx
  ON public.calendar_events USING gin (audience_diocese_slugs);
CREATE INDEX IF NOT EXISTS calendar_events_audience_countries_idx
  ON public.calendar_events USING gin (audience_countries);

-- Expose the new fields on the public views
CREATE OR REPLACE VIEW public.organizer_profiles_public AS
 SELECT id, user_id, org_name, parish, description, categories, website_url,
        logo_url, status, created_at, updated_at, diocese_slug, diocese_slugs
   FROM public.organizer_profiles
  WHERE status = 'approved'::organizer_status;

CREATE OR REPLACE VIEW public.calendar_events_public AS
 SELECT id, title, description, category, category_other, start_at, end_at,
        all_day, venue_name, address, latitude, longitude, parish, is_free,
        price_note, registration_url, submitted_by_user_id, status, created_at,
        updated_at, is_featured, poster_url, diocese_slug,
        audience_diocese_slugs, audience_countries, audience_scope
   FROM public.calendar_events
  WHERE status = 'approved'::event_status;

-- Keep the profile upsert aware of the multi-diocese list
CREATE OR REPLACE FUNCTION public.upsert_my_organizer_profile(_patch jsonb)
RETURNS SETOF public.organizer_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  uid uuid := auth.uid();
  slugs text[];
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  slugs := COALESCE(
    (SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(_patch->'diocese_slugs','[]'::jsonb)) AS x),
    ARRAY[]::text[]
  );
  IF cardinality(slugs) = 0 AND NULLIF(_patch->>'diocese_slug','') IS NOT NULL THEN
    slugs := ARRAY[_patch->>'diocese_slug'];
  END IF;

  INSERT INTO public.organizer_profiles (
    user_id, org_name, parish, description, categories, categories_other,
    contact_email, contact_phone, representative_name, address, diocese_slug,
    diocese_slugs, website_url, logo_url
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
    COALESCE(NULLIF(_patch->>'diocese_slug',''), slugs[1]),
    slugs,
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
    diocese_slugs = EXCLUDED.diocese_slugs,
    website_url = EXCLUDED.website_url,
    logo_url = EXCLUDED.logo_url,
    updated_at = now();

  RETURN QUERY SELECT * FROM public.organizer_profiles WHERE user_id = uid;
END;
$fn$;
