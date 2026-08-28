-- Add support for multiple event languages.
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS event_languages text[];

-- Backfill: turn the existing single language into an array.
UPDATE public.calendar_events
   SET event_languages = ARRAY[event_language]
 WHERE event_languages IS NULL
   AND event_language IS NOT NULL
   AND event_language <> '';

-- Keep event_language in sync going forward (first selected language).
CREATE OR REPLACE FUNCTION public.sync_event_language()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.event_languages IS NOT NULL AND array_length(NEW.event_languages, 1) > 0 THEN
    NEW.event_language := NEW.event_languages[1];
  ELSE
    NEW.event_language := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS calendar_events_sync_language ON public.calendar_events;
CREATE TRIGGER calendar_events_sync_language
  BEFORE INSERT OR UPDATE OF event_languages ON public.calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_event_language();

-- Update the public view to expose the array.
CREATE OR REPLACE VIEW public.calendar_events_public AS
 SELECT id, title, description, category, category_other, start_at, end_at,
        all_day, venue_name, address, latitude, longitude, parish, is_free,
        price_note, registration_url, submitted_by_user_id, status, created_at,
        updated_at, is_featured, poster_url, diocese_slug,
        audience_diocese_slugs, audience_countries, audience_scope,
        event_language, event_languages
   FROM public.calendar_events
  WHERE status = 'approved'::event_status;

ALTER VIEW public.calendar_events_public SET (security_invoker = on);
GRANT SELECT ON public.calendar_events_public TO anon, authenticated;