CREATE TABLE public.dm_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid NOT NULL,
  diocese_slug text REFERENCES public.dioceses(slug),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.dm_group_members (
  group_id uuid NOT NULL REFERENCES public.dm_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE public.dm_group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.dm_groups(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL,
  body text,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dm_group_messages_group ON public.dm_group_messages(group_id, created_at);
CREATE INDEX idx_dm_group_members_user ON public.dm_group_members(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dm_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dm_group_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dm_group_messages TO authenticated;
GRANT ALL ON public.dm_groups TO service_role;
GRANT ALL ON public.dm_group_members TO service_role;
GRANT ALL ON public.dm_group_messages TO service_role;

CREATE OR REPLACE FUNCTION public.is_dm_group_member(_group_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dm_group_members m
    WHERE m.group_id = _group_id AND m.user_id = _user_id
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_dm_group_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_dm_group_member(uuid, uuid) TO authenticated, service_role;

ALTER TABLE public.dm_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_group_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their groups" ON public.dm_groups FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.is_dm_group_member(id, auth.uid()));
CREATE POLICY "Approved organizers can create groups" ON public.dm_groups FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.is_approved_organizer(auth.uid()));
CREATE POLICY "Creator can rename group" ON public.dm_groups FOR UPDATE TO authenticated
  USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE POLICY "Creator can delete group" ON public.dm_groups FOR DELETE TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Members can view membership" ON public.dm_group_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_dm_group_member(group_id, auth.uid()));
CREATE POLICY "Members can add participants" ON public.dm_group_members FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.dm_groups g WHERE g.id = group_id AND g.created_by = auth.uid())
    OR public.is_dm_group_member(group_id, auth.uid())
  );
CREATE POLICY "Update own membership" ON public.dm_group_members FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Leave group or creator removes" ON public.dm_group_members FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.dm_groups g WHERE g.id = group_id AND g.created_by = auth.uid())
  );

CREATE POLICY "Members can read group messages" ON public.dm_group_messages FOR SELECT TO authenticated
  USING (public.is_dm_group_member(group_id, auth.uid()));
CREATE POLICY "Members can send group messages" ON public.dm_group_messages FOR INSERT TO authenticated
  WITH CHECK (sender_user_id = auth.uid() AND public.is_dm_group_member(group_id, auth.uid()));
CREATE POLICY "Senders can delete their group messages" ON public.dm_group_messages FOR DELETE TO authenticated
  USING (sender_user_id = auth.uid());

ALTER TABLE public.dm_group_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_group_messages;