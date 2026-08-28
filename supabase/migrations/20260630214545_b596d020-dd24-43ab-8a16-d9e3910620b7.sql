
CREATE OR REPLACE FUNCTION public.admin_update_event(_event_id uuid, _patch jsonb)
RETURNS public.calendar_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.calendar_events;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.calendar_events SET
    title            = COALESCE(_patch->>'title', title),
    description      = COALESCE(_patch->>'description', description),
    venue_name       = COALESCE(_patch->>'venue_name', venue_name),
    address          = COALESCE(_patch->>'address', address),
    start_at         = COALESCE((_patch->>'start_at')::timestamptz, start_at),
    end_at           = COALESCE((_patch->>'end_at')::timestamptz, end_at),
    poster_url       = COALESCE(_patch->>'poster_url', poster_url),
    registration_url = COALESCE(_patch->>'registration_url', registration_url),
    guest_email      = COALESCE(_patch->>'guest_email', guest_email),
    rejection_reason = COALESCE(_patch->>'rejection_reason', rejection_reason),
    status           = COALESCE((_patch->>'status')::event_status, status)
  WHERE id = _event_id
  RETURNING * INTO r;

  RETURN r;
END;
$$;
