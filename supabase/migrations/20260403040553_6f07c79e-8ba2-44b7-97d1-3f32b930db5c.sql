
CREATE POLICY "Anon can insert gift raffle items"
ON public.gift_raffle_items
FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Anon can delete gift raffle items"
ON public.gift_raffle_items
FOR DELETE
TO anon
USING (true);
