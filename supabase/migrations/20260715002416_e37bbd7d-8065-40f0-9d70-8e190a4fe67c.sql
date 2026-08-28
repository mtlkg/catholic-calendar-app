-- Restore the table-level access needed by the Data API for public viewing and guest submissions.
-- Column-level SELECT restrictions from earlier security work still prevent guest_email,
-- rejection_reason, and other non-granted columns from being exposed to public clients.
GRANT SELECT, INSERT ON public.calendar_events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_events TO authenticated;
GRANT ALL ON public.calendar_events TO service_role;

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
      AND status = 'pending'::event_status
    )
  );