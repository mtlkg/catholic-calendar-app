-- Allow anon to delete orders
CREATE POLICY "Anon can delete orders"
  ON public.orders FOR DELETE
  TO anon
  USING (true);

-- Allow anon to delete tickets
CREATE POLICY "Anon can delete tickets"
  ON public.tickets FOR DELETE
  TO anon
  USING (true);