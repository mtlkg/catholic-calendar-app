CREATE OR REPLACE FUNCTION public.require_phone_for_unverified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.submitted_by_user_id IS NULL OR NOT public.is_approved_organizer(NEW.submitted_by_user_id) THEN
    IF NEW.guest_phone IS NULL OR length(regexp_replace(NEW.guest_phone, '\D', '', 'g')) < 8 THEN
      RAISE EXCEPTION 'A contact phone number is required for unverified submissions';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS require_phone_for_unverified ON public.calendar_events;
CREATE TRIGGER require_phone_for_unverified
BEFORE INSERT ON public.calendar_events
FOR EACH ROW EXECUTE FUNCTION public.require_phone_for_unverified();