ALTER TABLE public.organizer_profiles ADD COLUMN IF NOT EXISTS categories_other text;
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS category_other text;