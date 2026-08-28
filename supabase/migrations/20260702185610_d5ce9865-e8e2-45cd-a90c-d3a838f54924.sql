DROP POLICY IF EXISTS "Authenticated can view their own sponsor logo" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload their own sponsor logo" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update their own sponsor logo" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete their own sponsor logo" ON storage.objects;

CREATE POLICY "Authenticated can view their own sponsor logo"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'sponsor-logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

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