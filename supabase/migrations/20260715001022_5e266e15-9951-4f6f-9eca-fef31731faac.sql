
-- =========================================================================
-- 1. calendar_events: force all inserts to 'pending', remove verified auto-approve
-- =========================================================================
DROP POLICY IF EXISTS "Anyone can submit an event" ON public.calendar_events;

CREATE POLICY "Anyone can submit an event"
  ON public.calendar_events
  FOR INSERT
  WITH CHECK (
    (
      auth.uid() IS NULL
      AND guest_email IS NOT NULL
      AND guest_name IS NOT NULL
      AND status = 'pending'::event_status
    )
    OR (
      auth.uid() = submitted_by_user_id
      AND status = 'pending'::event_status
    )
  );

-- Update trigger: no longer auto-approve verified organizers. Everything stays
-- pending until an admin reviews it. Free-submission counter still increments
-- for unverified users so future caps remain applicable if payments are re-enabled.
CREATE OR REPLACE FUNCTION public.enforce_free_submission_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_paying boolean;
  v_verified boolean;
BEGIN
  IF NEW.submitted_by_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT status::text INTO v_status
  FROM public.organizer_profiles
  WHERE user_id = NEW.submitted_by_user_id;

  v_paying := public.is_paying_verified(NEW.submitted_by_user_id);
  v_verified := (v_status = 'approved') OR v_paying;

  -- Always start as pending; admin must approve. Never auto-approve here.
  NEW.status := 'pending'::event_status;

  -- Only unverified users count against the free-submission ledger.
  IF NOT v_verified THEN
    UPDATE public.organizer_profiles
      SET free_submissions_used = COALESCE(free_submissions_used, 0) + 1
    WHERE user_id = NEW.submitted_by_user_id;
  END IF;

  RETURN NEW;
END;
$$;

-- =========================================================================
-- 2. organizer_profiles: bind self-insert/self-update policies to authenticated
--    role and reaffirm status cannot be flipped to 'approved' by the owner.
-- =========================================================================
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.organizer_profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.organizer_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending'::organizer_status
  );

DROP POLICY IF EXISTS "Users can update their own profile" ON public.organizer_profiles;
CREATE POLICY "Users can update their own profile"
  ON public.organizer_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND status = (
      SELECT op.status
      FROM public.organizer_profiles op
      WHERE op.user_id = auth.uid()
    )
  );

-- =========================================================================
-- 3. email_send_log / email_send_state / email_unsubscribe_tokens:
--    revoke residual anon/authenticated grants; scope policies to service_role
--    role explicitly so nothing is reachable from client apps.
-- =========================================================================
REVOKE ALL ON public.email_send_log FROM anon, authenticated;
REVOKE ALL ON public.email_send_state FROM anon, authenticated;
REVOKE ALL ON public.email_unsubscribe_tokens FROM anon, authenticated;

GRANT ALL ON public.email_send_log TO service_role;
GRANT ALL ON public.email_send_state TO service_role;
GRANT ALL ON public.email_unsubscribe_tokens TO service_role;

-- Rebind policies to the service_role role explicitly (in addition to the
-- auth.role() runtime check) so PostgREST rejects requests earlier.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('email_send_log', 'email_send_state', 'email_unsubscribe_tokens')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

CREATE POLICY "Service role manages email_send_log"
  ON public.email_send_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role manages email_send_state"
  ON public.email_send_state
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role manages email_unsubscribe_tokens"
  ON public.email_unsubscribe_tokens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =========================================================================
-- 4. featured_slots: hide Stripe identifiers from anon/authenticated via
--    column-level grants. Row-level policy stays the same so the slot picker
--    keeps showing which dates/ranks are taken.
-- =========================================================================
REVOKE SELECT ON public.featured_slots FROM anon, authenticated;
GRANT SELECT
  (id, event_id, slot_date, rank, amount_cents, status, refunded_at, created_at, updated_at)
  ON public.featured_slots TO anon, authenticated;
