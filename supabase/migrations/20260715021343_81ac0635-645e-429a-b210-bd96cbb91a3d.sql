DROP POLICY IF EXISTS "Anyone can submit an event" ON public.calendar_events;

CREATE POLICY "Anyone can submit an event"
ON public.calendar_events
FOR INSERT
TO anon, authenticated
WITH CHECK (
  (
    auth.uid() IS NULL
    AND submitted_by_user_id IS NULL
    AND guest_email IS NOT NULL
    AND guest_name IS NOT NULL
    AND status = 'pending'::event_status
  )
  OR (
    auth.uid() = submitted_by_user_id
    AND status = ANY (ARRAY['pending'::event_status, 'approved'::event_status])
  )
);