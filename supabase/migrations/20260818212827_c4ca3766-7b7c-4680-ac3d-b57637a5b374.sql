CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  locale text NOT NULL DEFAULT 'en',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions(user_id);

ALTER TABLE public.notification_prefs
  ADD COLUMN IF NOT EXISTS push_follow_new_event boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_event_reminder boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_dm boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_thread_reply boolean NOT NULL DEFAULT true;

ALTER TABLE public.organizer_follows ADD COLUMN IF NOT EXISTS push_endpoint text;
ALTER TABLE public.event_interests ADD COLUMN IF NOT EXISTS push_endpoint text;

CREATE OR REPLACE FUNCTION public.save_push_subscription(
  _endpoint text, _p256dh text, _auth text, _locale text DEFAULT 'en'
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _endpoint IS NULL OR _endpoint = '' OR _p256dh IS NULL OR _auth IS NULL THEN
    RAISE EXCEPTION 'invalid subscription';
  END IF;
  INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth, locale)
  VALUES (auth.uid(), _endpoint, _p256dh, _auth, COALESCE(NULLIF(_locale,''),'en'))
  ON CONFLICT (endpoint) DO UPDATE SET
    user_id = COALESCE(auth.uid(), public.push_subscriptions.user_id),
    p256dh = EXCLUDED.p256dh,
    auth = EXCLUDED.auth,
    locale = EXCLUDED.locale,
    last_seen_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_push_subscription(_endpoint text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.push_subscriptions WHERE endpoint = _endpoint;
$$;

REVOKE ALL ON FUNCTION public.save_push_subscription(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_push_subscription(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_push_subscription(text, text, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_push_subscription(text) TO anon, authenticated, service_role;