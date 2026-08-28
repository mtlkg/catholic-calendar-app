CREATE OR REPLACE FUNCTION public.is_paying_verified(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = _user_id
      AND product_id = 'verified_organizer'
      AND (
        (status IN ('active','trialing') AND (current_period_end IS NULL OR current_period_end > now()))
        OR (status = 'canceled' AND current_period_end IS NOT NULL AND current_period_end > now())
      )
  );
$function$;

GRANT EXECUTE ON FUNCTION public.is_paying_verified(uuid) TO authenticated, service_role;