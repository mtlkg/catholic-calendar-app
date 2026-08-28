-- 1. Push subscription helpers no longer need SECURITY DEFINER
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

GRANT INSERT, UPDATE, DELETE ON public.push_subscriptions TO anon, authenticated;
GRANT SELECT ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

DROP POLICY IF EXISTS "Own push subscriptions readable" ON public.push_subscriptions;
CREATE POLICY "Own push subscriptions readable"
ON public.push_subscriptions FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Save own push subscription" ON public.push_subscriptions;
CREATE POLICY "Save own push subscription"
ON public.push_subscriptions FOR INSERT TO anon, authenticated
WITH CHECK (user_id IS NOT DISTINCT FROM auth.uid());

DROP POLICY IF EXISTS "Update own push subscription" ON public.push_subscriptions;
CREATE POLICY "Update own push subscription"
ON public.push_subscriptions FOR UPDATE TO anon, authenticated
USING (user_id IS NULL OR user_id = auth.uid())
WITH CHECK (user_id IS NOT DISTINCT FROM auth.uid());

DROP POLICY IF EXISTS "Delete own push subscription" ON public.push_subscriptions;
CREATE POLICY "Delete own push subscription"
ON public.push_subscriptions FOR DELETE TO anon, authenticated
USING (user_id IS NULL OR user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.save_push_subscription(_endpoint text, _p256dh text, _auth text, _locale text DEFAULT 'en'::text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
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
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  DELETE FROM public.push_subscriptions
  WHERE endpoint = _endpoint
    AND (user_id IS NULL OR user_id = auth.uid());
$$;

REVOKE EXECUTE ON FUNCTION public.save_push_subscription(text, text, text, text) FROM public;
REVOKE EXECUTE ON FUNCTION public.delete_push_subscription(text) FROM public;
GRANT EXECUTE ON FUNCTION public.save_push_subscription(text, text, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_push_subscription(text) TO anon, authenticated, service_role;

-- 2. Trigger-only helper must not be callable from the API
REVOKE EXECUTE ON FUNCTION public.sync_event_language() FROM public, anon, authenticated;

-- 3. Chat attachments: only actual conversation/thread participants
CREATE OR REPLACE FUNCTION public.can_read_chat_file(_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    split_part(_name, '/', 1) = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.direct_messages m
      WHERE m.attachments @> jsonb_build_array(jsonb_build_object('path', _name))
        AND (m.sender_user_id = auth.uid() OR m.recipient_user_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.dm_group_messages g
      JOIN public.dm_group_members mem
        ON mem.group_id = g.group_id AND mem.user_id = auth.uid()
      WHERE g.attachments @> jsonb_build_array(jsonb_build_object('path', _name))
    )
    OR EXISTS (
      SELECT 1
      FROM public.discussion_replies r
      JOIN public.discussion_threads t ON t.id = r.thread_id
      WHERE r.attachments @> jsonb_build_array(jsonb_build_object('path', _name))
        AND (
          t.author_user_id = auth.uid()
          OR r.author_user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.discussion_replies r2
            WHERE r2.thread_id = t.id AND r2.author_user_id = auth.uid()
          )
        )
    )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.can_read_chat_file(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_read_chat_file(text) TO authenticated, service_role;