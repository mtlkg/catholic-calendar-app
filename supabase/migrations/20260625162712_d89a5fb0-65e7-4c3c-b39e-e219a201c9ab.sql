
CREATE OR REPLACE FUNCTION public.is_approved_organizer(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizer_profiles
    WHERE user_id = _user_id AND status = 'approved'
  )
$$;

-- Threads: replace public SELECT with approved-organizer/admin SELECT
DROP POLICY IF EXISTS "Threads are public" ON public.discussion_threads;
CREATE POLICY "Approved organizers and admins can read threads"
ON public.discussion_threads FOR SELECT
TO authenticated
USING (
  public.is_approved_organizer(auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- Replies: same restriction
DROP POLICY IF EXISTS "Replies are public" ON public.discussion_replies;
CREATE POLICY "Approved organizers and admins can read replies"
ON public.discussion_replies FOR SELECT
TO authenticated
USING (
  public.is_approved_organizer(auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- Admin can delete any direct message
CREATE POLICY "Admins can delete any direct message"
ON public.direct_messages FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));
