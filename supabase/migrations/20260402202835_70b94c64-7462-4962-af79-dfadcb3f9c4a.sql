
-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can view their own orders by email" ON public.orders;

-- Only the service_role (used by edge functions) can insert orders
CREATE POLICY "Service role can insert orders"
ON public.orders
FOR INSERT
TO service_role
WITH CHECK (true);

-- Only the service_role can read orders
CREATE POLICY "Service role can select orders"
ON public.orders
FOR SELECT
TO service_role
USING (true);

-- Allow service_role to update orders (needed for webhook status updates)
CREATE POLICY "Service role can update orders"
ON public.orders
FOR UPDATE
TO service_role
USING (true);
