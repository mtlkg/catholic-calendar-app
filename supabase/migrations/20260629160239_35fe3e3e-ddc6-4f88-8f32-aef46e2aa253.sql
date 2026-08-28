
-- Schedule hourly reminder dispatcher.
DO $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  -- Pull existing project URL/service role from any scheduled job, fall back to vault if available.
  BEGIN
    SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN v_url := NULL; END;
  BEGIN
    SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN v_key := NULL; END;

  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE NOTICE 'Skipping cron schedule — project_url / service_role_key not in vault';
    RETURN;
  END IF;

  -- Remove any prior schedule so this is idempotent.
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'send-event-reminders-hourly';

  PERFORM cron.schedule(
    'send-event-reminders-hourly',
    '7 * * * *',
    format($f$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', %L),
        body := '{}'::jsonb
      );
    $f$, v_url || '/functions/v1/send-event-reminders', 'Bearer ' || v_key)
  );
END $$;
