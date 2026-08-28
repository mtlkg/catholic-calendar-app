GRANT INSERT ON public.organizer_follows TO anon;
GRANT SELECT, INSERT, DELETE ON public.organizer_follows TO authenticated;
GRANT ALL ON public.organizer_follows TO service_role;