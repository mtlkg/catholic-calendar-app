
CREATE TABLE public.organizer_follows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organizer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  follower_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  follower_email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organizer_user_id, follower_email)
);

CREATE INDEX idx_organizer_follows_organizer ON public.organizer_follows(organizer_user_id);
CREATE INDEX idx_organizer_follows_follower_user ON public.organizer_follows(follower_user_id);

GRANT SELECT, INSERT, DELETE ON public.organizer_follows TO authenticated;
GRANT SELECT, INSERT ON public.organizer_follows TO anon;
GRANT ALL ON public.organizer_follows TO service_role;

ALTER TABLE public.organizer_follows ENABLE ROW LEVEL SECURITY;

-- Anyone can create a follow (guest or signed in). If signed in, follower_user_id must match.
CREATE POLICY "Anyone can follow an organizer"
  ON public.organizer_follows FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    (auth.uid() IS NULL AND follower_user_id IS NULL)
    OR (auth.uid() IS NOT NULL AND (follower_user_id IS NULL OR follower_user_id = auth.uid()))
  );

-- Followers can see their own follows; organizers can see their followers.
CREATE POLICY "Users can view relevant follows"
  ON public.organizer_follows FOR SELECT
  TO authenticated
  USING (follower_user_id = auth.uid() OR organizer_user_id = auth.uid());

-- Followers can unfollow.
CREATE POLICY "Followers can unfollow"
  ON public.organizer_follows FOR DELETE
  TO authenticated
  USING (follower_user_id = auth.uid());

-- Trigger: when an event becomes approved, call the notify-followers edge function.
CREATE OR REPLACE FUNCTION public.notify_followers_on_event_approved()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NEW.status = 'approved'::public.event_status
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.submitted_by_user_id IS NOT NULL THEN
    BEGIN
      PERFORM net.http_post(
        url := 'https://iqyufdoumddklhvqcbpu.supabase.co/functions/v1/notify-followers-of-event',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Lovable-Context', 'notify-followers',
          'apikey', 'sb_publishable_5q4R8BtEPfnzcmKgRgzc2Q_ePv4Lpt0'
        ),
        body := jsonb_build_object('eventId', NEW.id::text)
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notify_followers_on_event_approved: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_followers_on_event_approved ON public.calendar_events;
CREATE TRIGGER trg_notify_followers_on_event_approved
AFTER INSERT OR UPDATE OF status ON public.calendar_events
FOR EACH ROW EXECUTE FUNCTION public.notify_followers_on_event_approved();
