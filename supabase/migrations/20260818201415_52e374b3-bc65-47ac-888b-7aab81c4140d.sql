-- 1. Notification preferences
CREATE TABLE public.notification_prefs (
  user_id uuid PRIMARY KEY,
  phone_e164 text,
  phone_verified_at timestamptz,
  locale text NOT NULL DEFAULT 'en',
  email_follow_new_event boolean NOT NULL DEFAULT true,
  sms_follow_new_event boolean NOT NULL DEFAULT false,
  email_event_reminder boolean NOT NULL DEFAULT true,
  sms_event_reminder boolean NOT NULL DEFAULT false,
  email_dm boolean NOT NULL DEFAULT true,
  sms_dm boolean NOT NULL DEFAULT false,
  email_thread_reply boolean NOT NULL DEFAULT true,
  sms_thread_reply boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_prefs TO authenticated;
GRANT ALL ON public.notification_prefs TO service_role;
ALTER TABLE public.notification_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own prefs select" ON public.notification_prefs FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own prefs insert" ON public.notification_prefs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own prefs update" ON public.notification_prefs FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own prefs delete" ON public.notification_prefs FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER tr_notification_prefs_updated_at BEFORE UPDATE ON public.notification_prefs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Phone verification codes (backend only)
CREATE TABLE public.phone_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  phone_e164 text NOT NULL,
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.phone_verifications TO service_role;
ALTER TABLE public.phone_verifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_phone_verifications_user ON public.phone_verifications(user_id, created_at DESC);

-- 3. SMS suppressions (STOP replies)
CREATE TABLE public.sms_suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164 text NOT NULL UNIQUE,
  reason text NOT NULL DEFAULT 'stop',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.sms_suppressions TO service_role;
ALTER TABLE public.sms_suppressions ENABLE ROW LEVEL SECURITY;

-- 4. SMS send log
CREATE TABLE public.sms_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_sid text,
  template_name text NOT NULL,
  recipient_phone text NOT NULL,
  status text NOT NULL,
  error_message text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sms_send_log TO authenticated;
GRANT ALL ON public.sms_send_log TO service_role;
ALTER TABLE public.sms_send_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read sms log" ON public.sms_send_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 5. Guest phone opt-in on follows and interests
ALTER TABLE public.organizer_follows
  ADD COLUMN IF NOT EXISTS phone_e164 text,
  ADD COLUMN IF NOT EXISTS sms_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'en';
ALTER TABLE public.event_interests
  ADD COLUMN IF NOT EXISTS phone_e164 text,
  ADD COLUMN IF NOT EXISTS sms_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'en';

-- 6. Conversation notification triggers (DMs + thread replies)
CREATE OR REPLACE FUNCTION public.notify_conversation_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_kind text;
BEGIN
  v_kind := CASE TG_TABLE_NAME WHEN 'direct_messages' THEN 'dm' ELSE 'thread_reply' END;
  BEGIN
    PERFORM net.http_post(
      url := 'https://iqyufdoumddklhvqcbpu.supabase.co/functions/v1/notify-conversation',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Lovable-Context', 'notify-conversation',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key'
        )
      ),
      body := jsonb_build_object('kind', v_kind, 'recordId', NEW.id::text)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_conversation_event failed: %', SQLERRM;
  END;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_dm ON public.direct_messages;
CREATE TRIGGER trg_notify_dm AFTER INSERT ON public.direct_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_conversation_event();

DROP TRIGGER IF EXISTS trg_notify_thread_reply ON public.discussion_replies;
CREATE TRIGGER trg_notify_thread_reply AFTER INSERT ON public.discussion_replies
  FOR EACH ROW EXECUTE FUNCTION public.notify_conversation_event();