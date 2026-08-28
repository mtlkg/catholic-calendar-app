
-- 1) Prevent event owners from changing their own event status via UPDATE.
DROP POLICY IF EXISTS "Users can update their own pending or approved events" ON public.calendar_events;

CREATE POLICY "Users can update their own pending or approved events"
ON public.calendar_events
FOR UPDATE
TO authenticated
USING (auth.uid() = submitted_by_user_id AND status = ANY (ARRAY['pending'::event_status, 'approved'::event_status]))
WITH CHECK (auth.uid() = submitted_by_user_id AND status = ANY (ARRAY['pending'::event_status, 'approved'::event_status]));

-- Trigger enforces that non-admins cannot change status via UPDATE, using OLD vs NEW.
CREATE OR REPLACE FUNCTION public.prevent_owner_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
      RAISE EXCEPTION 'Only administrators can change event status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS calendar_events_prevent_owner_status_change ON public.calendar_events;
CREATE TRIGGER calendar_events_prevent_owner_status_change
BEFORE UPDATE ON public.calendar_events
FOR EACH ROW EXECUTE FUNCTION public.prevent_owner_status_change();

-- 2) Scope anonymous guest poster uploads to a unique per-submission UUID subfolder.
DROP POLICY IF EXISTS "Guests can upload event posters to guest folder" ON storage.objects;

CREATE POLICY "Guests can upload event posters to guest subfolder"
ON storage.objects
FOR INSERT
TO anon
WITH CHECK (
  bucket_id = 'event-posters'
  AND (storage.foldername(name))[1] = 'guest'
  AND (storage.foldername(name))[2] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  AND array_length(storage.foldername(name), 1) = 2
);
