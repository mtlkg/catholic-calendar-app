ALTER TABLE public.discussion_replies REPLICA IDENTITY FULL;
ALTER TABLE public.discussion_threads REPLICA IDENTITY FULL;
ALTER TABLE public.direct_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.discussion_replies;
ALTER PUBLICATION supabase_realtime ADD TABLE public.discussion_threads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;