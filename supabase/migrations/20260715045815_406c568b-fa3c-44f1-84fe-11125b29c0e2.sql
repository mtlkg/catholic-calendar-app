CREATE OR REPLACE FUNCTION public.notify_followers_on_event_approved()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.status = 'approved'::public.event_status
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.submitted_by_user_id IS NOT NULL THEN
    BEGIN
      PERFORM net.http_post(
        url := 'https://iqyufdoumddklhvqcbpu.supabase.co/functions/v1/notify-followers-of-event',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Lovable-Context', 'notify-followers',
          'Authorization', 'Bearer ' || (
            SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key'
          )
        ),
        body := jsonb_build_object('eventId', NEW.id::text)
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notify_followers_on_event_approved: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$function$;