
CREATE OR REPLACE FUNCTION public.enforce_free_submission_cap()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_status text;
  v_paying boolean;
  v_verified boolean;
BEGIN
  IF NEW.submitted_by_user_id IS NULL THEN
    -- Guest submission: always pending.
    NEW.status := 'pending'::event_status;
    RETURN NEW;
  END IF;

  SELECT status::text INTO v_status
  FROM public.organizer_profiles
  WHERE user_id = NEW.submitted_by_user_id;

  v_paying := public.is_paying_verified(NEW.submitted_by_user_id);
  v_verified := (v_status = 'approved') OR v_paying;

  IF v_verified THEN
    -- Verified organizers: auto-approve.
    NEW.status := 'approved'::event_status;
  ELSE
    -- Unverified: pending + count against free submission cap.
    NEW.status := 'pending'::event_status;
    UPDATE public.organizer_profiles
      SET free_submissions_used = COALESCE(free_submissions_used, 0) + 1
    WHERE user_id = NEW.submitted_by_user_id;
  END IF;

  RETURN NEW;
END;
$function$;
