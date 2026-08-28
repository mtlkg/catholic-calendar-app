
CREATE TABLE public.tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  ticket_code text NOT NULL UNIQUE,
  ticket_type text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can insert tickets"
  ON public.tickets FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can select tickets"
  ON public.tickets FOR SELECT TO service_role
  USING (true);

CREATE POLICY "Anyone can view tickets"
  ON public.tickets FOR SELECT TO public
  USING (true);

CREATE INDEX idx_tickets_order_id ON public.tickets(order_id);
CREATE INDEX idx_tickets_ticket_type ON public.tickets(ticket_type);
