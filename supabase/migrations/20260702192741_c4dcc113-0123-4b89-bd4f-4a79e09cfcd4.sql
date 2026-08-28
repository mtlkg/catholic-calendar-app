
-- Restore safe SELECT grants on organizer_profiles (exclude PII columns)
GRANT SELECT (id, user_id, org_name, parish, website_url, logo_url, description, categories, status, categories_other, representative_name, created_at, updated_at)
  ON public.organizer_profiles TO anon, authenticated;

-- Restore safe SELECT grants on calendar_events (exclude guest PII and rejection_reason)
GRANT SELECT (id, title, description, start_at, end_at, all_day, category, venue_name, address, latitude, longitude, parish, is_free, price_note, registration_url, submitted_by_user_id, status, created_at, updated_at, is_featured, category_other, poster_url)
  ON public.calendar_events TO anon, authenticated;

-- Owners/admins still see guest_email, guest_name, rejection_reason via SECURITY DEFINER RPCs.
