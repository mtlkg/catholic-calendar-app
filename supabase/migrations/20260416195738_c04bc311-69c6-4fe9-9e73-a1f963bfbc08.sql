-- Orders: drop public select, anon insert/delete (keep service_role policies)
DROP POLICY IF EXISTS "Anyone can view orders" ON public.orders;
DROP POLICY IF EXISTS "Anon can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Anon can delete orders" ON public.orders;

-- Merchandise: drop anon write policies (keep public select)
DROP POLICY IF EXISTS "Anon can insert merchandise" ON public.merchandise;
DROP POLICY IF EXISTS "Anon can update merchandise" ON public.merchandise;
DROP POLICY IF EXISTS "Anon can delete merchandise" ON public.merchandise;

-- Sponsors: drop anon write policies (keep public select)
DROP POLICY IF EXISTS "Anon can insert sponsors" ON public.sponsors;
DROP POLICY IF EXISTS "Anon can update sponsors" ON public.sponsors;
DROP POLICY IF EXISTS "Anon can delete sponsors" ON public.sponsors;

-- Gift raffle items: drop anon write policies (keep public select)
DROP POLICY IF EXISTS "Anon can insert gift raffle items" ON public.gift_raffle_items;
DROP POLICY IF EXISTS "Anon can delete gift raffle items" ON public.gift_raffle_items;

-- Tickets: drop anon insert/delete (keep public select for ticket lookup by code, keep service_role policies)
DROP POLICY IF EXISTS "Anon can insert tickets" ON public.tickets;
DROP POLICY IF EXISTS "Anon can delete tickets" ON public.tickets;