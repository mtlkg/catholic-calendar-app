
CREATE TABLE public.dinner_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  attendance TEXT NOT NULL,
  additional_guests INTEGER NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  dietary_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.dinner_rsvps TO anon, authenticated;
GRANT ALL ON public.dinner_rsvps TO service_role;
ALTER TABLE public.dinner_rsvps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can submit RSVP" ON public.dinner_rsvps FOR INSERT TO anon, authenticated WITH CHECK (true);
