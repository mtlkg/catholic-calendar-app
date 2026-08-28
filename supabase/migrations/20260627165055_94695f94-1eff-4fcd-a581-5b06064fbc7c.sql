
-- Enforce that only globalcatholiccalendar@gmail.com can hold the admin role.
CREATE OR REPLACE FUNCTION public.enforce_single_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  IF NEW.role = 'admin'::app_role THEN
    SELECT lower(email) INTO v_email FROM auth.users WHERE id = NEW.user_id;
    IF v_email IS DISTINCT FROM 'globalcatholiccalendar@gmail.com' THEN
      RAISE EXCEPTION 'Admin role is restricted to globalcatholiccalendar@gmail.com';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_single_admin_trigger ON public.user_roles;
CREATE TRIGGER enforce_single_admin_trigger
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.enforce_single_admin();

-- Clean up any stray admin rows that don't match the allowed email.
DELETE FROM public.user_roles
WHERE role = 'admin'::app_role
  AND user_id NOT IN (
    SELECT id FROM auth.users WHERE lower(email) = 'globalcatholiccalendar@gmail.com'
  );
