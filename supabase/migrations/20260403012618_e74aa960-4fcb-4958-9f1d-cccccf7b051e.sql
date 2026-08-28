
-- Create admission inventory table
CREATE TABLE public.admission_inventory (
  id integer NOT NULL DEFAULT 1 PRIMARY KEY,
  total_available integer NOT NULL DEFAULT 225,
  total_sold integer NOT NULL DEFAULT 0
);

-- Seed initial row
INSERT INTO public.admission_inventory (id, total_available, total_sold) VALUES (1, 225, 0);

-- Enable RLS
ALTER TABLE public.admission_inventory ENABLE ROW LEVEL SECURITY;

-- Anyone can view
CREATE POLICY "Anyone can view admission inventory"
  ON public.admission_inventory FOR SELECT
  TO public
  USING (true);

-- Allow anon to insert orders (for manual entry from admin dashboard)
CREATE POLICY "Anon can insert orders"
  ON public.orders FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anon to insert tickets (for manual entry)
CREATE POLICY "Anon can insert tickets"
  ON public.tickets FOR INSERT
  TO anon
  WITH CHECK (true);

-- Replace the inventory trigger function to handle both types
CREATE OR REPLACE FUNCTION public.update_grand_prize_inventory()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.order_type = 'grand_prize' AND NEW.status = 'paid' AND (OLD IS NULL OR OLD.status != 'paid') THEN
    UPDATE public.grand_prize_inventory
    SET total_sold = total_sold + NEW.quantity
    WHERE id = 1;
  END IF;
  IF NEW.order_type = 'admission' AND NEW.status = 'paid' AND (OLD IS NULL OR OLD.status != 'paid') THEN
    UPDATE public.admission_inventory
    SET total_sold = total_sold + NEW.quantity
    WHERE id = 1;
  END IF;
  RETURN NEW;
END;
$function$;

-- Drop existing trigger if any and recreate for both INSERT and UPDATE
DROP TRIGGER IF EXISTS update_inventory_on_order ON public.orders;
CREATE TRIGGER update_inventory_on_order
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_grand_prize_inventory();
