
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.discussion_replies ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.direct_messages ALTER COLUMN body DROP NOT NULL;
ALTER TABLE public.discussion_replies ALTER COLUMN body DROP NOT NULL;

CREATE POLICY "Approved organizers can upload chat files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-uploads'
  AND public.is_approved_organizer(auth.uid())
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Approved organizers can read chat files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-uploads'
  AND (public.is_approved_organizer(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "Owners can delete their chat files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'chat-uploads'
  AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin'::app_role))
);
