-- 1. Roles on group membership
DO $$ BEGIN
  CREATE TYPE public.dm_group_role AS ENUM ('owner','admin','member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.dm_group_members
  ADD COLUMN IF NOT EXISTS role public.dm_group_role NOT NULL DEFAULT 'member';

UPDATE public.dm_group_members m
SET role = 'owner'
FROM public.dm_groups g
WHERE g.id = m.group_id AND g.created_by = m.user_id AND m.role <> 'owner';

-- 2. Role helpers (security definer to avoid recursive RLS)
CREATE OR REPLACE FUNCTION public.dm_group_role_of(_group_id uuid, _user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role::text FROM public.dm_group_members
  WHERE group_id = _group_id AND user_id = _user_id
$$;

CREATE OR REPLACE FUNCTION public.is_dm_group_manager(_group_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dm_group_members
    WHERE group_id = _group_id AND user_id = _user_id AND role IN ('owner','admin')
  ) OR EXISTS (
    SELECT 1 FROM public.dm_groups g
    WHERE g.id = _group_id AND g.created_by = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_dm_group_owner(_group_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dm_group_members
    WHERE group_id = _group_id AND user_id = _user_id AND role = 'owner'
  ) OR EXISTS (
    SELECT 1 FROM public.dm_groups g
    WHERE g.id = _group_id AND g.created_by = _user_id
  )
$$;

-- 3. Tighten membership policies to respect roles
DROP POLICY IF EXISTS "Members can add participants" ON public.dm_group_members;
CREATE POLICY "Managers can add participants"
ON public.dm_group_members FOR INSERT TO authenticated
WITH CHECK (
  public.is_dm_group_manager(group_id, auth.uid())
  OR EXISTS (SELECT 1 FROM public.dm_groups g WHERE g.id = group_id AND g.created_by = auth.uid())
);

DROP POLICY IF EXISTS "Leave group or creator removes" ON public.dm_group_members;
CREATE POLICY "Leave group or manager removes"
ON public.dm_group_members FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  OR (public.is_dm_group_manager(group_id, auth.uid()) AND role <> 'owner')
);

DROP POLICY IF EXISTS "Update own membership" ON public.dm_group_members;
CREATE POLICY "Update own read state"
ON public.dm_group_members FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid() AND role::text = public.dm_group_role_of(group_id, auth.uid()));

CREATE POLICY "Owner manages roles"
ON public.dm_group_members FOR UPDATE TO authenticated
USING (public.is_dm_group_owner(group_id, auth.uid()))
WITH CHECK (public.is_dm_group_owner(group_id, auth.uid()));

DROP POLICY IF EXISTS "Creator can rename group" ON public.dm_groups;
CREATE POLICY "Managers can rename group"
ON public.dm_groups FOR UPDATE TO authenticated
USING (public.is_dm_group_manager(id, auth.uid()))
WITH CHECK (public.is_dm_group_manager(id, auth.uid()));

DROP POLICY IF EXISTS "Creator can delete group" ON public.dm_groups;
CREATE POLICY "Owner can delete group"
ON public.dm_groups FOR DELETE TO authenticated
USING (public.is_dm_group_owner(id, auth.uid()));

-- 4. Activity log (no FK on group_id so history survives group deletion)
CREATE TABLE IF NOT EXISTS public.dm_group_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL,
  group_name text,
  actor_user_id uuid,
  target_user_id uuid,
  action text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.dm_group_activity TO authenticated;
GRANT ALL ON public.dm_group_activity TO service_role;
ALTER TABLE public.dm_group_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members and participants can view group activity"
ON public.dm_group_activity FOR SELECT TO authenticated
USING (
  public.is_dm_group_member(group_id, auth.uid())
  OR actor_user_id = auth.uid()
  OR target_user_id = auth.uid()
);

CREATE INDEX IF NOT EXISTS idx_dm_group_activity_group ON public.dm_group_activity (group_id, created_at DESC);

-- 5. Triggers write the log automatically
CREATE OR REPLACE FUNCTION public.log_dm_group_member_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_name text;
  v_action text;
  v_target uuid;
  v_detail jsonb := '{}'::jsonb;
  v_group uuid;
BEGIN
  v_group := COALESCE(NEW.group_id, OLD.group_id);
  SELECT name INTO v_name FROM public.dm_groups WHERE id = v_group;

  IF TG_OP = 'INSERT' THEN
    v_target := NEW.user_id;
    v_action := CASE WHEN NEW.user_id = auth.uid() THEN 'joined' ELSE 'member_added' END;
    v_detail := jsonb_build_object('role', NEW.role::text);
  ELSIF TG_OP = 'DELETE' THEN
    v_target := OLD.user_id;
    v_action := CASE WHEN OLD.user_id = auth.uid() THEN 'left' ELSE 'member_removed' END;
    v_detail := jsonb_build_object('role', OLD.role::text);
  ELSE
    IF NEW.role IS NOT DISTINCT FROM OLD.role THEN
      RETURN NULL;
    END IF;
    v_target := NEW.user_id;
    v_action := 'role_changed';
    v_detail := jsonb_build_object('from', OLD.role::text, 'to', NEW.role::text);
  END IF;

  INSERT INTO public.dm_group_activity (group_id, group_name, actor_user_id, target_user_id, action, detail)
  VALUES (v_group, v_name, auth.uid(), v_target, v_action, v_detail);

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_dm_group_member_event ON public.dm_group_members;
CREATE TRIGGER trg_log_dm_group_member_event
AFTER INSERT OR UPDATE OR DELETE ON public.dm_group_members
FOR EACH ROW EXECUTE FUNCTION public.log_dm_group_member_event();

CREATE OR REPLACE FUNCTION public.log_dm_group_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.dm_group_activity (group_id, group_name, actor_user_id, target_user_id, action, detail)
    VALUES (NEW.id, NEW.name, auth.uid(), auth.uid(), 'group_created', '{}'::jsonb);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.name IS DISTINCT FROM OLD.name THEN
      INSERT INTO public.dm_group_activity (group_id, group_name, actor_user_id, action, detail)
      VALUES (NEW.id, NEW.name, auth.uid(), 'group_renamed', jsonb_build_object('from', OLD.name, 'to', NEW.name));
    END IF;
    RETURN NEW;
  ELSE
    INSERT INTO public.dm_group_activity (group_id, group_name, actor_user_id, action, detail)
    VALUES (OLD.id, OLD.name, auth.uid(), 'group_deleted', '{}'::jsonb);
    RETURN OLD;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_dm_group_lifecycle ON public.dm_groups;
CREATE TRIGGER trg_log_dm_group_lifecycle
AFTER INSERT OR UPDATE OR DELETE ON public.dm_groups
FOR EACH ROW EXECUTE FUNCTION public.log_dm_group_lifecycle();