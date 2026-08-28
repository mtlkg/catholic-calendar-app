CREATE OR REPLACE FUNCTION public.normalize_contact_phone(_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT NULLIF(right(regexp_replace(coalesce(_phone, ''), '\D', '', 'g'), 10), '')
$$;

CREATE OR REPLACE FUNCTION public.free_submissions_used(_user_id uuid, _email text, _phone text)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_email text := NULLIF(lower(btrim(coalesce(_email, ''))), '');
  v_phone text := public.normalize_contact_phone(_phone);
  v_since timestamptz := now() - interval '1 year';
  v_used int;
BEGIN
  SELECT COUNT(DISTINCT COALESCE(e.recurrence_group_id::text, e.id::text))
    INTO v_used
  FROM public.calendar_events e
  LEFT JOIN public.organizer_profiles p ON p.user_id = e.submitted_by_user_id
  WHERE e.created_at >= v_since
    AND (
      (_user_id IS NOT NULL AND e.submitted_by_user_id = _user_id)
      OR (v_email IS NOT NULL AND (
            lower(btrim(coalesce(e.guest_email, ''))) = v_email
            OR lower(btrim(coalesce(p.contact_email, ''))) = v_email))
      OR (v_phone IS NOT NULL AND (
            public.normalize_contact_phone(e.guest_phone) = v_phone
            OR public.normalize_contact_phone(p.contact_phone) = v_phone))
    );
  RETURN COALESCE(v_used, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.free_submissions_used(uuid, text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.my_free_submission_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_phone text;
  v_used int;
  v_resets timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('used', 0, 'cap', 2, 'resets_at', NULL);
  END IF;
  SELECT contact_email, contact_phone INTO v_email, v_phone
  FROM public.organizer_profiles WHERE user_id = v_uid;
  v_used := public.free_submissions_used(v_uid, v_email, v_phone);

  SELECT max(created_at) INTO v_resets
  FROM public.calendar_events
  WHERE submitted_by_user_id = v_uid AND created_at >= now() - interval '1 year';

  RETURN jsonb_build_object(
    'used', v_used,
    'cap', 2,
    'resets_at', CASE WHEN v_used >= 2 THEN v_resets + interval '1 year' ELSE NULL END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.my_free_submission_status() TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_free_submission_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_status text;
  v_paying boolean;
  v_verified boolean;
  v_used int;
  v_paid int;
  v_email text;
  v_phone text;
  c_free_cap constant int := 2;
BEGIN
  -- Guest submissions: identity is the contact email AND phone, so a new
  -- address alone does not buy another round of free posts.
  IF NEW.submitted_by_user_id IS NULL THEN
    NEW.status := 'pending'::event_status;
    v_used := public.free_submissions_used(NULL, NEW.guest_email, NEW.guest_phone);
    IF v_used >= c_free_cap THEN
      RAISE EXCEPTION 'guest_submission_limit_reached';
    END IF;
    RETURN NEW;
  END IF;

  SELECT status::text, COALESCE(paid_submissions_remaining, 0), contact_email, contact_phone
    INTO v_status, v_paid, v_email, v_phone
  FROM public.organizer_profiles
  WHERE user_id = NEW.submitted_by_user_id;

  v_paying := public.is_paying_verified(NEW.submitted_by_user_id);
  v_verified := (v_status = 'approved') OR v_paying;

  IF v_verified THEN
    NEW.status := 'approved'::event_status;
    RETURN NEW;
  END IF;

  NEW.status := 'pending'::event_status;

  v_used := public.free_submissions_used(
    NEW.submitted_by_user_id,
    COALESCE(NULLIF(btrim(coalesce(v_email, '')), ''), NEW.guest_email),
    COALESCE(NULLIF(btrim(coalesce(v_phone, '')), ''), NEW.guest_phone)
  );

  IF v_used < c_free_cap THEN
    UPDATE public.organizer_profiles
      SET free_submissions_used = v_used + 1
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
$$;