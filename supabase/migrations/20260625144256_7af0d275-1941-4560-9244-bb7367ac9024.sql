
-- =========================================================
-- ROLES
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'organizer');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- TIMESTAMP HELPER
-- =========================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =========================================================
-- ORGANIZER PROFILES
-- =========================================================
CREATE TYPE public.organizer_status AS ENUM ('pending', 'approved', 'suspended');

CREATE TABLE public.organizer_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  org_name text,
  parish text,
  contact_email text,
  contact_phone text,
  website_url text,
  logo_url text,
  description text,
  categories text[] NOT NULL DEFAULT '{}',
  status public.organizer_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.organizer_profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.organizer_profiles TO authenticated;
GRANT ALL ON public.organizer_profiles TO service_role;

ALTER TABLE public.organizer_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved organizer profiles are public"
ON public.organizer_profiles FOR SELECT TO anon, authenticated
USING (status = 'approved');

CREATE POLICY "Users can view their own profile"
ON public.organizer_profiles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
ON public.organizer_profiles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update their own profile"
ON public.organizer_profiles FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id AND status = (SELECT status FROM public.organizer_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can update any profile"
ON public.organizer_profiles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER tr_organizer_profiles_updated_at
BEFORE UPDATE ON public.organizer_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.organizer_profiles (user_id, contact_email, org_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'org_name', NEW.raw_user_meta_data->>'full_name', NEW.email)
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- CALENDAR EVENTS
-- =========================================================
CREATE TYPE public.event_category AS ENUM (
  'mass', 'adoration', 'bible_study', 'retreat', 'conference',
  'youth', 'social', 'service', 'other'
);
CREATE TYPE public.event_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  start_at timestamptz NOT NULL,
  end_at timestamptz,
  all_day boolean NOT NULL DEFAULT false,
  category public.event_category NOT NULL DEFAULT 'other',
  venue_name text,
  address text,
  latitude double precision,
  longitude double precision,
  parish text,
  is_free boolean NOT NULL DEFAULT true,
  price_note text,
  registration_url text,
  submitted_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  guest_name text,
  guest_email text,
  status public.event_status NOT NULL DEFAULT 'pending',
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_calendar_events_start ON public.calendar_events (start_at);
CREATE INDEX idx_calendar_events_status ON public.calendar_events (status);

GRANT SELECT ON public.calendar_events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_events TO authenticated;
GRANT ALL ON public.calendar_events TO service_role;

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved events are public"
ON public.calendar_events FOR SELECT TO anon, authenticated
USING (status = 'approved');

CREATE POLICY "Users can view their own events"
ON public.calendar_events FOR SELECT TO authenticated
USING (auth.uid() = submitted_by_user_id);

CREATE POLICY "Admins can view all events"
ON public.calendar_events FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can submit an event"
ON public.calendar_events FOR INSERT TO anon, authenticated
WITH CHECK (
  status = 'pending'
  AND (
    (auth.uid() IS NULL AND guest_email IS NOT NULL AND guest_name IS NOT NULL)
    OR (auth.uid() = submitted_by_user_id)
  )
);

CREATE POLICY "Users can update their own pending events"
ON public.calendar_events FOR UPDATE TO authenticated
USING (auth.uid() = submitted_by_user_id AND status = 'pending')
WITH CHECK (auth.uid() = submitted_by_user_id AND status = 'pending');

CREATE POLICY "Users can delete their own events"
ON public.calendar_events FOR DELETE TO authenticated
USING (auth.uid() = submitted_by_user_id);

CREATE POLICY "Admins can update any event"
ON public.calendar_events FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete any event"
ON public.calendar_events FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER tr_calendar_events_updated_at
BEFORE UPDATE ON public.calendar_events
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- DISCUSSION THREADS & REPLIES
-- =========================================================
CREATE TYPE public.thread_category AS ENUM (
  'collaboration', 'resources', 'questions', 'announcements'
);

CREATE TABLE public.discussion_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category public.thread_category NOT NULL DEFAULT 'collaboration',
  title text NOT NULL,
  body text NOT NULL,
  pinned boolean NOT NULL DEFAULT false,
  locked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.discussion_threads TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discussion_threads TO authenticated;
GRANT ALL ON public.discussion_threads TO service_role;

ALTER TABLE public.discussion_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Threads are public"
ON public.discussion_threads FOR SELECT TO anon, authenticated
USING (true);

CREATE POLICY "Approved organizers can post threads"
ON public.discussion_threads FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = author_user_id
  AND EXISTS (
    SELECT 1 FROM public.organizer_profiles
    WHERE user_id = auth.uid() AND status = 'approved'
  )
);

CREATE POLICY "Authors can update their threads"
ON public.discussion_threads FOR UPDATE TO authenticated
USING (auth.uid() = author_user_id AND NOT locked)
WITH CHECK (auth.uid() = author_user_id);

CREATE POLICY "Authors can delete their threads"
ON public.discussion_threads FOR DELETE TO authenticated
USING (auth.uid() = author_user_id);

CREATE POLICY "Admins can manage threads"
ON public.discussion_threads FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER tr_discussion_threads_updated_at
BEFORE UPDATE ON public.discussion_threads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.discussion_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.discussion_threads(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_discussion_replies_thread ON public.discussion_replies (thread_id, created_at);

GRANT SELECT ON public.discussion_replies TO anon;
GRANT SELECT, INSERT, DELETE ON public.discussion_replies TO authenticated;
GRANT ALL ON public.discussion_replies TO service_role;

ALTER TABLE public.discussion_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Replies are public"
ON public.discussion_replies FOR SELECT TO anon, authenticated
USING (true);

CREATE POLICY "Approved organizers can reply"
ON public.discussion_replies FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = author_user_id
  AND EXISTS (
    SELECT 1 FROM public.organizer_profiles
    WHERE user_id = auth.uid() AND status = 'approved'
  )
  AND EXISTS (
    SELECT 1 FROM public.discussion_threads
    WHERE id = thread_id AND NOT locked
  )
);

CREATE POLICY "Authors can delete their replies"
ON public.discussion_replies FOR DELETE TO authenticated
USING (auth.uid() = author_user_id);

CREATE POLICY "Admins can delete any reply"
ON public.discussion_replies FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- DIRECT MESSAGES
-- =========================================================
CREATE TABLE public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_direct_messages_pair ON public.direct_messages (sender_user_id, recipient_user_id, created_at);
CREATE INDEX idx_direct_messages_recipient ON public.direct_messages (recipient_user_id, created_at);

GRANT SELECT, INSERT, UPDATE ON public.direct_messages TO authenticated;
GRANT ALL ON public.direct_messages TO service_role;

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can read their messages"
ON public.direct_messages FOR SELECT TO authenticated
USING (auth.uid() = sender_user_id OR auth.uid() = recipient_user_id);

CREATE POLICY "Approved organizers can send messages to approved organizers"
ON public.direct_messages FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = sender_user_id
  AND EXISTS (
    SELECT 1 FROM public.organizer_profiles
    WHERE user_id = auth.uid() AND status = 'approved'
  )
  AND EXISTS (
    SELECT 1 FROM public.organizer_profiles
    WHERE user_id = recipient_user_id AND status = 'approved'
  )
);

CREATE POLICY "Recipients can mark messages as read"
ON public.direct_messages FOR UPDATE TO authenticated
USING (auth.uid() = recipient_user_id)
WITH CHECK (auth.uid() = recipient_user_id);

-- =========================================================
-- REALTIME
-- =========================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.discussion_replies;
