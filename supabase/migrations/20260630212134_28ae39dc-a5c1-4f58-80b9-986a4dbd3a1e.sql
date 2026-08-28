
-- 1. Subscriptions table (Stripe-managed)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_subscription_id text NOT NULL UNIQUE,
  stripe_customer_id text NOT NULL,
  product_id text NOT NULL,
  price_id text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_id ON public.subscriptions(stripe_subscription_id);

GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

-- Helper: does this user have a paying verified subscription right now?
CREATE OR REPLACE FUNCTION public.is_paying_verified(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = _user_id
      AND product_id = 'verified_organizer'
      AND (
        (status IN ('active','trialing') AND (current_period_end IS NULL OR current_period_end > now()))
        OR (status = 'canceled' AND current_period_end IS NOT NULL AND current_period_end > now())
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_paying_verified(uuid) TO authenticated, anon;

-- 2. Free submission counter on organizer_profiles
ALTER TABLE public.organizer_profiles
  ADD COLUMN IF NOT EXISTS free_submissions_used int NOT NULL DEFAULT 0;

-- Trigger to enforce the 5-event cap on unverified, unapproved organizers
CREATE OR REPLACE FUNCTION public.enforce_free_submission_cap()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_used int;
  v_paying boolean;
BEGIN
  IF NEW.submitted_by_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT status::text, free_submissions_used
    INTO v_status, v_used
  FROM public.organizer_profiles
  WHERE user_id = NEW.submitted_by_user_id;

  v_paying := public.is_paying_verified(NEW.submitted_by_user_id);

  IF v_status = 'approved' OR v_paying THEN
    RETURN NEW;
  END IF;

  IF COALESCE(v_used, 0) >= 5 THEN
    RAISE EXCEPTION 'free_submission_limit_reached'
      USING HINT = 'You have used your 5 free event submissions. Subscribe for $10/month or $100/year to submit more.';
  END IF;

  UPDATE public.organizer_profiles
    SET free_submissions_used = COALESCE(free_submissions_used, 0) + 1
  WHERE user_id = NEW.submitted_by_user_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_free_submission_cap ON public.calendar_events;
CREATE TRIGGER trg_enforce_free_submission_cap
  BEFORE INSERT ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.enforce_free_submission_cap();

-- 3. Featured slots table (per-day ranks)
CREATE TABLE IF NOT EXISTS public.featured_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  slot_date date NOT NULL,
  rank int NOT NULL CHECK (rank BETWEEN 1 AND 4),
  amount_cents int NOT NULL,
  stripe_session_id text UNIQUE,
  stripe_payment_intent_id text,
  status text NOT NULL DEFAULT 'pending', -- pending | paid | refunded | canceled
  refunded_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Only one active (pending OR paid) holder per (date, rank). Releases on refund/cancel.
CREATE UNIQUE INDEX IF NOT EXISTS uq_featured_slots_active_holder
  ON public.featured_slots(slot_date, rank)
  WHERE status IN ('pending','paid');

CREATE INDEX IF NOT EXISTS idx_featured_slots_event ON public.featured_slots(event_id);
CREATE INDEX IF NOT EXISTS idx_featured_slots_date_rank ON public.featured_slots(slot_date, rank);

GRANT SELECT ON public.featured_slots TO anon, authenticated;
GRANT INSERT, UPDATE ON public.featured_slots TO authenticated;
GRANT ALL ON public.featured_slots TO service_role;

ALTER TABLE public.featured_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read paid slots"
  ON public.featured_slots FOR SELECT
  USING (status = 'paid' OR public.has_role(auth.uid(), 'admin'::app_role)
         OR EXISTS (SELECT 1 FROM public.calendar_events e WHERE e.id = event_id AND e.submitted_by_user_id = auth.uid()));

CREATE POLICY "Owner can claim a slot"
  ON public.featured_slots FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.calendar_events e WHERE e.id = event_id AND e.submitted_by_user_id = auth.uid())
  );

CREATE POLICY "Service role manages slots"
  ON public.featured_slots FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER trg_featured_slots_updated_at
  BEFORE UPDATE ON public.featured_slots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. event_interests: mark notification state for organizer email
ALTER TABLE public.event_interests
  ADD COLUMN IF NOT EXISTS organizer_notified_at timestamptz;

-- 5. Admin "edit anything" RPCs
CREATE OR REPLACE FUNCTION public.admin_update_event(_event_id uuid, _patch jsonb)
RETURNS public.calendar_events
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.calendar_events;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.calendar_events SET
    title              = COALESCE(_patch->>'title', title),
    description        = COALESCE(_patch->>'description', description),
    location_name      = COALESCE(_patch->>'location_name', location_name),
    location_address   = COALESCE(_patch->>'location_address', location_address),
    start_at           = COALESCE((_patch->>'start_at')::timestamptz, start_at),
    end_at             = COALESCE((_patch->>'end_at')::timestamptz, end_at),
    poster_url         = COALESCE(_patch->>'poster_url', poster_url),
    website_url        = COALESCE(_patch->>'website_url', website_url),
    guest_email        = COALESCE(_patch->>'guest_email', guest_email),
    rejection_reason   = COALESCE(_patch->>'rejection_reason', rejection_reason),
    status             = COALESCE((_patch->>'status')::event_status, status)
  WHERE id = _event_id
  RETURNING * INTO r;

  RETURN r;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_event(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_organizer(_user_id uuid, _patch jsonb)
RETURNS public.organizer_profiles
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.organizer_profiles;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.organizer_profiles SET
    org_name            = COALESCE(_patch->>'org_name', org_name),
    parish              = COALESCE(_patch->>'parish', parish),
    contact_email       = COALESCE(_patch->>'contact_email', contact_email),
    contact_phone       = COALESCE(_patch->>'contact_phone', contact_phone),
    representative_name = COALESCE(_patch->>'representative_name', representative_name),
    address             = COALESCE(_patch->>'address', address),
    website_url         = COALESCE(_patch->>'website_url', website_url),
    description         = COALESCE(_patch->>'description', description),
    logo_url            = COALESCE(_patch->>'logo_url', logo_url),
    status              = COALESCE((_patch->>'status')::organizer_status, status)
  WHERE user_id = _user_id
  RETURNING * INTO r;

  RETURN r;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_organizer(uuid, jsonb) TO authenticated;
