DROP POLICY IF EXISTS "Users can update their own pending events" ON public.calendar_events;
CREATE POLICY "Users can update their own pending or approved events"
ON public.calendar_events
FOR UPDATE
USING (auth.uid() = submitted_by_user_id AND status IN ('pending'::event_status, 'approved'::event_status))
WITH CHECK (auth.uid() = submitted_by_user_id AND status IN ('pending'::event_status, 'approved'::event_status));