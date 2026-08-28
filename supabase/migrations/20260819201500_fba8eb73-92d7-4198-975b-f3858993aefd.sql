CREATE POLICY "Event owners can view interests"
  ON public.event_interests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.calendar_events e
      WHERE e.id = event_interests.event_id
        AND e.submitted_by_user_id = auth.uid()
    )
  );