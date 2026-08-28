
CREATE POLICY "Authenticated can upload their own sponsor logo"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'sponsor-logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Authenticated can update their own sponsor logo"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'sponsor-logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'sponsor-logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Authenticated can delete their own sponsor logo"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'sponsor-logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
