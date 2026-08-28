
CREATE OR REPLACE FUNCTION public.restore_inventory_on_delete()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status = 'paid' AND OLD.order_type = 'grand_prize' THEN
    UPDATE public.grand_prize_inventory
    SET total_sold = GREATEST(total_sold - OLD.quantity, 0)
    WHERE id = 1;
  END IF;
  IF OLD.status = 'paid' AND OLD.order_type = 'admission' THEN
    UPDATE public.admission_inventory
    SET total_sold = GREATEST(total_sold - OLD.quantity, 0)
    WHERE id = 1;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER restore_inventory_on_order_delete
  BEFORE DELETE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.restore_inventory_on_delete();
