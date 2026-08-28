CREATE TABLE public.merchandise (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  name text NOT NULL,
  price text NOT NULL,
  image_url text,
  external_url text NOT NULL
);

ALTER TABLE public.merchandise ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view merchandise" ON public.merchandise FOR SELECT USING (true);
CREATE POLICY "Anon can insert merchandise" ON public.merchandise FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update merchandise" ON public.merchandise FOR UPDATE TO anon USING (true);
CREATE POLICY "Anon can delete merchandise" ON public.merchandise FOR DELETE TO anon USING (true);