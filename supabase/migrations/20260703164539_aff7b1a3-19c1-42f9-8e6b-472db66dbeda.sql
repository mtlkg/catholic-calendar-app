
-- Add paid submissions counter
ALTER TABLE public.organizer_profiles
  ADD COLUMN IF NOT EXISTS paid_submissions_remaining int NOT NULL DEFAULT 0;

-- Replace the free-cap trigger with one that ALSO auto-approves verified submissions
-- and honors paid single-submission credits.
CREATE OR REPLACE FUNCTION public.enforce_free_submission_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_status text;
  v_used int;
  v_paid int;
  v_paying boolean;
  v_verified boolean;
BEGIN
  IF NEW.submitted_by_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT status::text, free_submissions_used, paid_submissions_remaining
    INTO v_status, v_used, v_paid
  FROM public.organizer_profiles
  WHERE user_id = NEW.submitted_by_user_id;

  v_paying := public.is_paying_verified(NEW.submitted_by_user_id);
  v_verified := (v_status = 'approved') OR v_paying;

  -- Verified organizers: auto-approve their events; no cap.
  IF v_verified THEN
    NEW.status := 'approved';
    RETURN NEW;
  END IF;

  -- Unverified: use a paid single-submission credit if available.
  IF COALESCE(v_paid, 0) > 0 THEN
    UPDATE public.organizer_profiles
      SET paid_submissions_remaining = paid_submissions_remaining - 1
    WHERE user_id = NEW.submitted_by_user_id;
    RETURN NEW;
  END IF;

  -- Otherwise enforce the 5-free cap.
  IF COALESCE(v_used, 0) >= 5 THEN
    RAISE EXCEPTION 'free_submission_limit_reached'
      USING HINT = 'You have used your 5 free event submissions. Buy a single submission for $5, or become a verified organizer for unlimited posts.';
  END IF;

  UPDATE public.organizer_profiles
    SET free_submissions_used = COALESCE(free_submissions_used, 0) + 1
  WHERE user_id = NEW.submitted_by_user_id;

  RETURN NEW;
END;
$function$;

-- Ensure the trigger exists BEFORE INSERT so NEW.status mutation takes effect.
DROP TRIGGER IF EXISTS tr_enforce_free_submission_cap ON public.calendar_events;
CREATE TRIGGER tr_enforce_free_submission_cap
BEFORE INSERT ON public.calendar_events
FOR EACH ROW EXECUTE FUNCTION public.enforce_free_submission_cap();

-- Loosen INSERT policy so verified organizers may submit with status = 'approved'
-- (the trigger above is what actually decides the final status server-side).
DROP POLICY IF EXISTS "Anyone can submit an event" ON public.calendar_events;
CREATE POLICY "Anyone can submit an event"
ON public.calendar_events FOR INSERT TO anon, authenticated
WITH CHECK (
  status IN ('pending', 'approved')
  AND (
    (auth.uid() IS NULL AND guest_email IS NOT NULL AND guest_name IS NOT NULL)
    OR (auth.uid() = submitted_by_user_id)
  )
);
