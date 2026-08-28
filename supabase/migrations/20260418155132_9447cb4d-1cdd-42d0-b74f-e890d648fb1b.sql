ALTER TABLE public.gift_raffle_items
  ADD COLUMN IF NOT EXISTS name_fr text,
  ADD COLUMN IF NOT EXISTS description_fr text;

ALTER TABLE public.sponsors
  ADD COLUMN IF NOT EXISTS name_fr text;

DELETE FROM public.gift_raffle_items WHERE id = 'fdd20c58-7af2-44bb-977e-41a44958b3ec';