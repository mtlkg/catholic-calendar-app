ALTER TYPE public.event_category ADD VALUE IF NOT EXISTS 'fundraiser';
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS calendar_events_is_featured_idx ON public.calendar_events(is_featured) WHERE is_featured = true;