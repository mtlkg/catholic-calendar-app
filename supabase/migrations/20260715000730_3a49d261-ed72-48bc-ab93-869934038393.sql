CREATE POLICY "Guests can upload event posters to guest folder"
ON storage.objects
FOR INSERT
TO anon
WITH CHECK (
  bucket_id = 'event-posters'
  AND (storage.foldername(name))[1] = 'guest'
);