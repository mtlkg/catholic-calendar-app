ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method text;

-- Backfill existing rows: anything with a stripe_session_id is a card sale,
-- everything else (manual in-person entries up to now) is cash.
UPDATE public.orders
SET payment_method = CASE
  WHEN stripe_session_id IS NOT NULL AND stripe_session_id <> '' THEN 'card'
  ELSE 'cash'
END
WHERE payment_method IS NULL;