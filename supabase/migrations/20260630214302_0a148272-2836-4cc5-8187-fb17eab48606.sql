
-- Release stale "pending" featured slot reservations after 30 minutes so others can claim them.
CREATE OR REPLACE FUNCTION public.release_stale_featured_slots()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.featured_slots
     SET status = 'canceled'
   WHERE status = 'pending'
     AND created_at < now() - interval '30 minutes';
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('release-stale-featured-slots')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'release-stale-featured-slots');
    PERFORM cron.schedule(
      'release-stale-featured-slots',
      '*/10 * * * *',
      $cron$ SELECT public.release_stale_featured_slots(); $cron$
    );
  END IF;
END $$;
