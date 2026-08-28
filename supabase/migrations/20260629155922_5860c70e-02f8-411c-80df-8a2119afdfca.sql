
CREATE POLICY "Anyone can upload event posters" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'event-posters');

CREATE POLICY "Anyone can read event posters" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'event-posters');

CREATE POLICY "Owners can update their event posters" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'event-posters' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners can delete their event posters" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'event-posters' AND auth.uid()::text = (storage.foldername(name))[1]);
