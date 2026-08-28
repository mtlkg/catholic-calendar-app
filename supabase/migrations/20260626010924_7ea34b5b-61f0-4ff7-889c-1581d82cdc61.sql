CREATE TABLE public.thread_pins (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_id uuid NOT NULL REFERENCES public.discussion_threads(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, thread_id)
);
GRANT SELECT, INSERT, DELETE ON public.thread_pins TO authenticated;
GRANT ALL ON public.thread_pins TO service_role;
ALTER TABLE public.thread_pins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own pins" ON public.thread_pins
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);