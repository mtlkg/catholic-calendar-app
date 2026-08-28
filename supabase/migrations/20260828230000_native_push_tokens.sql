-- Device tokens for the native iOS/Android app (Capacitor push notifications),
-- parallel to public.push_subscriptions which holds web push subscriptions.
CREATE TABLE IF NOT EXISTS public.push_device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  platform text NOT NULL CHECK (platform IN ('ios', 'android')),
  token text NOT NULL UNIQUE,
  locale text NOT NULL DEFAULT 'en',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.push_device_tokens TO service_role;
ALTER TABLE public.push_device_tokens ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_push_device_tokens_user ON public.push_device_tokens(user_id);

CREATE OR REPLACE FUNCTION public.save_native_push_token(
  _token text, _platform text, _locale text DEFAULT 'en'
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _token IS NULL OR _token = '' OR _platform NOT IN ('ios', 'android') THEN
    RAISE EXCEPTION 'invalid device token';
  END IF;
  INSERT INTO public.push_device_tokens (user_id, platform, token, locale)
  VALUES (auth.uid(), _platform, _token, COALESCE(NULLIF(_locale,''),'en'))
  ON CONFLICT (token) DO UPDATE SET
    user_id = COALESCE(auth.uid(), public.push_device_tokens.user_id),
    platform = EXCLUDED.platform,
    locale = EXCLUDED.locale,
    last_seen_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_native_push_token(_token text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.push_device_tokens WHERE token = _token;
$$;

REVOKE ALL ON FUNCTION public.save_native_push_token(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_native_push_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_native_push_token(text, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_native_push_token(text) TO anon, authenticated, service_role;
