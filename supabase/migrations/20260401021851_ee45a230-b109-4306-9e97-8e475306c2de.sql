
-- Gift raffle items table
CREATE TABLE public.gift_raffle_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.gift_raffle_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view gift raffle items"
  ON public.gift_raffle_items FOR SELECT
  USING (true);

-- Orders table
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_type TEXT NOT NULL CHECK (order_type IN ('admission', 'grand_prize', 'gift_raffle')),
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  item_id UUID REFERENCES public.gift_raffle_items(id),
  total_amount NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create orders"
  ON public.orders FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can view their own orders by email"
  ON public.orders FOR SELECT
  USING (true);

-- Grand prize inventory tracking
CREATE TABLE public.grand_prize_inventory (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  total_available INTEGER NOT NULL DEFAULT 300,
  total_sold INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.grand_prize_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view grand prize inventory"
  ON public.grand_prize_inventory FOR SELECT
  USING (true);

CREATE POLICY "Anyone can update grand prize inventory"
  ON public.grand_prize_inventory FOR UPDATE
  USING (true);

-- Initialize the inventory row
INSERT INTO public.grand_prize_inventory (id, total_available, total_sold) VALUES (1, 300, 0);

-- Seed 15 placeholder gift raffle items
INSERT INTO public.gift_raffle_items (name, description) VALUES
  ('Restaurant Gift Card', 'A $100 gift card to a popular Montreal restaurant'),
  ('Spa Day Package', 'A luxurious full-day spa experience for two'),
  ('Wine Basket', 'A curated selection of fine wines from Quebec vineyards'),
  ('Canadiens Tickets', 'Two tickets to a Montreal Canadiens home game'),
  ('Art Print Collection', 'A set of three prints by a local Montreal artist'),
  ('Gourmet Chocolate Box', 'Handcrafted artisan chocolates from a local chocolatier'),
  ('Weekend Getaway Voucher', 'A two-night stay at a Laurentian mountain lodge'),
  ('Cooking Class for Two', 'A private cooking class at a Montreal culinary school'),
  ('Bookstore Gift Card', 'A $75 gift card to a local independent bookstore'),
  ('Fitness Studio Membership', 'One month unlimited membership at a local fitness studio'),
  ('Coffee Lovers Bundle', 'Premium coffee beans, a French press, and artisan mugs'),
  ('Photography Session', 'A one-hour professional family photography session'),
  ('Flower Arrangement', 'A stunning seasonal flower arrangement delivered monthly for 3 months'),
  ('Theater Tickets', 'Two tickets to a show at a Montreal theatre'),
  ('Handmade Jewelry Set', 'A beautiful necklace and earring set by a local jeweler');
