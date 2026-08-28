-- The public events view is security-invoker, so readers need column-level SELECT
-- on the non-sensitive columns of the base table. Guest contact PII
-- (submitter name/email/phone) is deliberately excluded.
GRANT SELECT (
  id, title, description, category, category_other, start_at, end_at, all_day,
  venue_name, address, latitude, longitude, parish, is_free, price_note,
  registration_url, submitted_by_user_id, status, created_at, updated_at,
  is_featured, poster_url, diocese_slug, audience_diocese_slugs,
  audience_countries, audience_scope, event_language
) ON public.calendar_events TO anon, authenticated;