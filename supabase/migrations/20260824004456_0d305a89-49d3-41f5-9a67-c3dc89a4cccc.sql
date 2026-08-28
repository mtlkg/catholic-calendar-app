GRANT SELECT (
  id, title, description, category, category_other, start_at, end_at, all_day,
  venue_name, address, latitude, longitude, parish, is_free, price_note,
  registration_url, submitted_by_user_id, status, created_at, updated_at,
  is_featured, poster_url, diocese_slug, audience_diocese_slugs,
  audience_countries, audience_scope, event_language, event_languages, video_url
) ON public.calendar_events TO anon, authenticated;

GRANT SELECT ON public.calendar_events_public TO anon, authenticated;