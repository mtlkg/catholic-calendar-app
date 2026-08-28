ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS item_id uuid NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_item_id ON public.tickets(item_id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS bucket_allocations jsonb NULL;