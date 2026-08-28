-- 1. Column grants needed for invoker-based public views
GRANT SELECT (diocese_slug, diocese_slugs) ON public.organizer_profiles TO anon, authenticated;
GRANT SELECT (diocese_slug, audience_diocese_slugs, audience_countries, audience_scope) ON public.calendar_events TO anon, authenticated;

-- Ensure PII columns are not readable by public roles
REVOKE SELECT (contact_email, contact_phone, address, representative_name) ON public.organizer_profiles FROM anon, authenticated;
REVOKE SELECT (guest_email, guest_phone, guest_name) ON public.calendar_events FROM anon, authenticated;

-- 2. Views run with the querying user's permissions (no SECURITY DEFINER views)
ALTER VIEW public.organizer_profiles_public SET (security_invoker = on);
ALTER VIEW public.calendar_events_public SET (security_invoker = on);

-- 3. Lock down internal SECURITY DEFINER helpers
REVOKE EXECUTE ON FUNCTION public.dm_group_role_of(uuid, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_dm_group_manager(uuid, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_dm_group_member(uuid, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_dm_group_owner(uuid, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.admin_stats(text[]) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.upsert_my_organizer_profile(jsonb) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.save_push_subscription(text, text, text, text) FROM public;
REVOKE EXECUTE ON FUNCTION public.delete_push_subscription(text) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_stats(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_my_organizer_profile(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_push_subscription(text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_push_subscription(text) TO anon, authenticated;

-- 4. Only remove your own push subscription
CREATE OR REPLACE FUNCTION public.delete_push_subscription(_endpoint text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  DELETE FROM public.push_subscriptions
  WHERE endpoint = _endpoint
    AND (user_id IS NULL OR user_id = auth.uid());
$$;

-- 5. Chat attachment access limited to conversation participants
CREATE OR REPLACE FUNCTION public.can_read_chat_file(_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    -- uploader (files are stored under <user_id>/...)
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
      SELECT 1 FROM public.discussion_replies r
      WHERE r.attachments @> jsonb_build_array(jsonb_build_object('path', _name))
        AND public.is_approved_organizer(auth.uid())
    )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.can_read_chat_file(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_read_chat_file(text) TO authenticated, service_role;

DROP POLICY IF EXISTS "Approved organizers can read chat files" ON storage.objects;
CREATE POLICY "Chat files readable by conversation participants"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'chat-uploads' AND public.can_read_chat_file(name));