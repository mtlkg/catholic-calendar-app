ALTER TABLE public.discussion_threads
ADD COLUMN IF NOT EXISTS last_activity_at timestamptz NOT NULL DEFAULT now();

UPDATE public.discussion_threads t
SET last_activity_at = GREATEST(
  t.created_at,
  COALESCE((SELECT MAX(created_at) FROM public.discussion_replies WHERE thread_id = t.id), t.created_at)
);

CREATE OR REPLACE FUNCTION public.update_thread_last_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.discussion_threads
  SET last_activity_at = NEW.created_at
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_discussion_replies_last_activity ON public.discussion_replies;
CREATE TRIGGER tr_discussion_replies_last_activity
AFTER INSERT ON public.discussion_replies
FOR EACH ROW EXECUTE FUNCTION public.update_thread_last_activity();

CREATE INDEX IF NOT EXISTS idx_discussion_threads_last_activity
ON public.discussion_threads (last_activity_at DESC);