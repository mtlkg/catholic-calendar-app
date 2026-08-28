CREATE OR REPLACE FUNCTION public.dispatch_event_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  PERFORM net.http_post(
    url := 'https://iqyufdoumddklhvqcbpu.supabase.co/functions/v1/send-event-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Lovable-Context', 'cron',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key'
      )
    ),
    body := '{}'::jsonb
  );
END;
$function$;

SELECT cron.schedule('send-event-reminders-hourly', '7 * * * *', $cron$ SELECT public.dispatch_event_reminders(); $cron$);