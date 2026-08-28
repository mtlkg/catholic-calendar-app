
-- Harden calendar_events INSERT policy: only verified organizers can insert status='approved'
DROP POLICY IF EXISTS "Anyone can submit an event" ON public.calendar_events;
CREATE POLICY "Anyone can submit an event" ON public.calendar_events
FOR INSERT WITH CHECK (
  -- Guest submissions must be pending
  (auth.uid() IS NULL AND guest_email IS NOT NULL AND guest_name IS NOT NULL AND status = 'pending'::event_status)
  OR
  -- Authenticated non-verified users: pending only
  (auth.uid() = submitted_by_user_id AND status = 'pending'::event_status)
  OR
  -- Verified organizers may insert as approved (trigger also promotes)
  (
    auth.uid() = submitted_by_user_id
    AND status = 'approved'::event_status
    AND (public.is_approved_organizer(auth.uid()) OR public.is_paying_verified(auth.uid()))
  )
);

-- Harden calendar_events UPDATE policy: pin status to prior value; only admins may change status
DROP POLICY IF EXISTS "Users can update their own pending or approved events" ON public.calendar_events;
CREATE POLICY "Users can update their own pending or approved events" ON public.calendar_events
FOR UPDATE
USING (
  auth.uid() = submitted_by_user_id
  AND status = ANY (ARRAY['pending'::event_status, 'approved'::event_status])
)
WITH CHECK (
  auth.uid() = submitted_by_user_id
  AND status = (SELECT ce.status FROM public.calendar_events ce WHERE ce.id = calendar_events.id)
);

-- Featured slots: server-side pricing so client-supplied amount_cents cannot be trusted
CREATE OR REPLACE FUNCTION public.set_featured_slot_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.amount_cents := CASE NEW.rank
    WHEN 1 THEN 1000
    WHEN 2 THEN 700
    WHEN 3 THEN 500
    WHEN 4 THEN 200
    ELSE NULL
  END;
  IF NEW.amount_cents IS NULL THEN
    RAISE EXCEPTION 'Invalid featured slot rank: %', NEW.rank;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_featured_slot_amount ON public.featured_slots;
CREATE TRIGGER trg_set_featured_slot_amount
BEFORE INSERT ON public.featured_slots
FOR EACH ROW EXECUTE FUNCTION public.set_featured_slot_amount();
