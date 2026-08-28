-- Add website_url to gift_raffle_items
ALTER TABLE public.gift_raffle_items ADD COLUMN website_url text;

-- Create sponsors table
CREATE TABLE public.sponsors (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  image_url text,
  website_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view sponsors" ON public.sponsors FOR SELECT USING (true);
CREATE POLICY "Anon can insert sponsors" ON public.sponsors FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can delete sponsors" ON public.sponsors FOR DELETE TO anon USING (true);
CREATE POLICY "Anon can update sponsors" ON public.sponsors FOR UPDATE TO anon USING (true);