ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS video_url text;

CREATE OR REPLACE VIEW public.calendar_events_public
WITH (security_invoker = true) AS
 SELECT id, title, description, category, category_other, start_at, end_at, all_day,
    venue_name, address, latitude, longitude, parish, is_free, price_note, registration_url,
    submitted_by_user_id, status, created_at, updated_at, is_featured, poster_url,
    diocese_slug, audience_diocese_slugs, audience_countries, audience_scope,
    event_language, event_languages, video_url
   FROM public.calendar_events
  WHERE status = 'approved'::event_status;

GRANT SELECT ON public.calendar_events_public TO anon, authenticated;

DROP POLICY IF EXISTS "event videos are readable" ON storage.objects;
CREATE POLICY "event videos are readable" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'event-videos');

DROP POLICY IF EXISTS "organizers upload their own event videos" ON storage.objects;
CREATE POLICY "organizers upload their own event videos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'event-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "organizers delete their own event videos" ON storage.objects;
CREATE POLICY "organizers delete their own event videos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'event-videos' AND (storage.foldername(name))[1] = auth.uid()::text);