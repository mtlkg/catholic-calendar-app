CREATE OR REPLACE FUNCTION public.queue_calendar_event_geocode()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_address text;
BEGIN
  -- Only geocode events that can appear on the public map, and only when a
  -- usable venue/address exists and coordinates are missing.
  IF NEW.status <> 'approved'::public.event_status THEN
    RETURN NULL;
  END IF;

  v_address := concat_ws(', ', NULLIF(NEW.venue_name, ''), NULLIF(NEW.address, ''));
  IF v_address = '' OR NEW.latitude IS NOT NULL THEN
    RETURN NULL;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := 'https://iqyufdoumddklhvqcbpu.supabase.co/functions/v1/geocode-address',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Lovable-Context', 'calendar-event-geocode',
        'apikey', 'sb_publishable_5q4R8BtEPfnzcmKgRgzc2Q_ePv4Lpt0'
      ),
      body := jsonb_build_object('address', v_address, 'eventId', NEW.id::text)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'calendar event geocode request failed for %: %', NEW.id, SQLERRM;
  END;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.queue_calendar_event_geocode() FROM PUBLIC, anon, authenticated;

UPDATE public.calendar_events
SET updated_at = updated_at
WHERE status = 'approved'::public.event_status
  AND latitude IS NULL
  AND (address IS NOT NULL OR venue_name IS NOT NULL);