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
  v_is_admin boolean;
  v_montreal_free boolean;
  v_used int;
  v_paid int;
  v_email text;
  v_phone text;
  c_free_cap constant int := 2;
BEGIN
  IF NEW.submitted_by_user_id IS NULL THEN
    NEW.status := 'pending'::event_status;
    v_used := public.free_submissions_used(NULL, NEW.guest_email, NEW.guest_phone);
    IF v_used >= c_free_cap THEN
      RAISE EXCEPTION 'guest_submission_limit_reached';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.submitted_by_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'event_owner_mismatch';
  END IF;

  SELECT p.status::text,
         COALESCE(p.paid_submissions_remaining, 0),
         p.contact_email,
         p.contact_phone,
         (
           p.status = 'approved'::organizer_status
           AND p.created_at > now() - interval '1 year'
           AND EXISTS (
             SELECT 1 FROM public.dioceses d
             WHERE d.slug = p.diocese_slug
               AND d.slug IN ('montreal', 'maronite-montreal', 'melkite-montreal', 'syriac-canada')
           )
         )
    INTO v_status, v_paid, v_email, v_phone, v_montreal_free
  FROM public.organizer_profiles p
  WHERE p.user_id = NEW.submitted_by_user_id;

  v_paying := public.is_paying_verified(NEW.submitted_by_user_id);
  v_is_admin := public.has_role(NEW.submitted_by_user_id, 'admin'::app_role);
  v_verified := v_status = 'approved' AND (v_paying OR v_montreal_free OR v_is_admin);

  IF v_verified THEN
    NEW.status := 'approved'::event_status;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'verified_organizer_activation_required';
END;
$function$;

DROP TRIGGER IF EXISTS tr_enforce_free_submission_cap ON public.calendar_events;