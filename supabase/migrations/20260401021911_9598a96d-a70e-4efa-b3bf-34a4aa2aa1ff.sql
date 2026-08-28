
-- Remove the permissive update policy
DROP POLICY "Anyone can update grand prize inventory" ON public.grand_prize_inventory;

-- Create a function to auto-update inventory on order insert
CREATE OR REPLACE FUNCTION public.update_grand_prize_inventory()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_type = 'grand_prize' THEN
    UPDATE public.grand_prize_inventory
    SET total_sold = total_sold + NEW.quantity
    WHERE id = 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger
CREATE TRIGGER on_grand_prize_order
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_grand_prize_inventory();
