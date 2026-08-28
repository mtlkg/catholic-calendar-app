-- Payments temporarily disabled: relax the free-submission cap so any signed-in
-- user can submit unlimited events. Verified organizers still get auto-approve;
-- unverified submissions still land as 'pending' for admin review.
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

  -- Verified organizers: auto-approve, unlimited.
  IF v_verified THEN
    NEW.status := 'approved';
    RETURN NEW;
  END IF;

  -- Payments disabled: unverified users get unlimited free submissions
  -- (still 'pending' for admin approval). Keep counting usage so the
  -- previous cap can be reinstated cleanly later.
  UPDATE public.organizer_profiles
    SET free_submissions_used = COALESCE(free_submissions_used, 0) + 1
  WHERE user_id = NEW.submitted_by_user_id;

  RETURN NEW;

  -- Previous behaviour (kept for reference — restore when re-enabling payments):
  --   IF COALESCE(v_paid, 0) > 0 THEN
  --     UPDATE public.organizer_profiles
  --       SET paid_submissions_remaining = paid_submissions_remaining - 1
  --     WHERE user_id = NEW.submitted_by_user_id;
  --     RETURN NEW;
  --   END IF;
  --   IF COALESCE(v_used, 0) >= 5 THEN
  --     RAISE EXCEPTION 'free_submission_limit_reached'
  --       USING HINT = 'You have used your 5 free event submissions. Buy a single submission for $5, or become a verified organizer for unlimited posts.';
  --   END IF;
END;
$function$;