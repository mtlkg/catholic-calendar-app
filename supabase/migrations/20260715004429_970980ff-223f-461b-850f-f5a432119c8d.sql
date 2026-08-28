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
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key'
        )
      ),
      body := jsonb_build_object('address', v_address, 'eventId', NEW.id::text)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'calendar event geocode request failed for %: %', NEW.id, SQLERRM;
  END;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_calendar_event_coordinates_on_location_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (
    NEW.address IS DISTINCT FROM OLD.address OR
    NEW.venue_name IS DISTINCT FROM OLD.venue_name
  ) THEN
    NEW.latitude := NULL;
    NEW.longitude := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clear_calendar_event_coordinates_on_location_change_trigger ON public.calendar_events;
CREATE TRIGGER clear_calendar_event_coordinates_on_location_change_trigger
BEFORE UPDATE OF address, venue_name ON public.calendar_events
FOR EACH ROW
EXECUTE FUNCTION public.clear_calendar_event_coordinates_on_location_change();

DROP TRIGGER IF EXISTS queue_calendar_event_geocode_trigger ON public.calendar_events;
CREATE TRIGGER queue_calendar_event_geocode_trigger
AFTER INSERT OR UPDATE OF status, address, venue_name, latitude ON public.calendar_events
FOR EACH ROW
WHEN (
  NEW.status = 'approved'::public.event_status
  AND NEW.latitude IS NULL
  AND (NEW.address IS NOT NULL OR NEW.venue_name IS NOT NULL)
)
EXECUTE FUNCTION public.queue_calendar_event_geocode();

-- Kick off one-time lookups for already-approved events that currently show as hidden.
UPDATE public.calendar_events
SET updated_at = updated_at
WHERE status = 'approved'::public.event_status
  AND latitude IS NULL
  AND (address IS NOT NULL OR venue_name IS NOT NULL);