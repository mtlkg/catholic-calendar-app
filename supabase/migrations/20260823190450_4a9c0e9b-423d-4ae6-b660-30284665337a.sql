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
  v_free_used int;
  v_paid int;
  v_guest_used int;
  c_free_cap constant int := 2;
BEGIN
  IF NEW.submitted_by_user_id IS NULL THEN
    NEW.status := 'pending'::event_status;
    -- Guests get the same 2 free submissions, counted per contact email.
    IF NEW.guest_email IS NOT NULL AND btrim(NEW.guest_email) <> '' THEN
      SELECT COUNT(DISTINCT COALESCE(recurrence_group_id::text, id::text))
        INTO v_guest_used
      FROM public.calendar_events
      WHERE submitted_by_user_id IS NULL
        AND lower(btrim(guest_email)) = lower(btrim(NEW.guest_email));
      IF v_guest_used >= c_free_cap THEN
        RAISE EXCEPTION 'guest_submission_limit_reached';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  SELECT status::text, COALESCE(free_submissions_used, 0), COALESCE(paid_submissions_remaining, 0)
    INTO v_status, v_free_used, v_paid
  FROM public.organizer_profiles
  WHERE user_id = NEW.submitted_by_user_id;

  v_paying := public.is_paying_verified(NEW.submitted_by_user_id);
  v_verified := (v_status = 'approved') OR v_paying;

  IF v_verified THEN
    NEW.status := 'approved'::event_status;
    RETURN NEW;
  END IF;

  NEW.status := 'pending'::event_status;

  IF v_free_used < c_free_cap THEN
    UPDATE public.organizer_profiles
      SET free_submissions_used = COALESCE(free_submissions_used, 0) + 1
    WHERE user_id = NEW.submitted_by_user_id;
  ELSIF v_paid > 0 THEN
    UPDATE public.organizer_profiles
      SET paid_submissions_remaining = COALESCE(paid_submissions_remaining, 0) - 1
    WHERE user_id = NEW.submitted_by_user_id;
  ELSE
    RAISE EXCEPTION 'free_submission_limit_reached';
  END IF;

  RETURN NEW;
END;
$function$;