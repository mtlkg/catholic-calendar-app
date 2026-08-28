ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS event_language text;

CREATE OR REPLACE VIEW public.calendar_events_public AS
 SELECT id, title, description, category, category_other, start_at, end_at,
        all_day, venue_name, address, latitude, longitude, parish, is_free,
        price_note, registration_url, submitted_by_user_id, status, created_at,
        updated_at, is_featured, poster_url, diocese_slug,
        audience_diocese_slugs, audience_countries, audience_scope, event_language
   FROM public.calendar_events
  WHERE status = 'approved'::event_status;

ALTER VIEW public.calendar_events_public SET (security_invoker = on);
GRANT SELECT ON public.calendar_events_public TO anon, authenticated;