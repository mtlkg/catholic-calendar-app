-- 1. Remove public SELECT on tickets (only edge functions need access via service role)
DROP POLICY IF EXISTS "Anyone can view tickets" ON public.tickets;

-- 2. Lock down SECURITY DEFINER trigger functions (only triggers should call them)
REVOKE EXECUTE ON FUNCTION public.update_grand_prize_inventory() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.restore_inventory_on_delete() FROM PUBLIC, anon, authenticated;

-- 3. Drop broad public SELECT on storage.objects for the sponsor-logos bucket so it cannot be enumerated.
-- Files remain accessible via their public CDN URLs (bucket is public).
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND cmd = 'SELECT'
      AND qual ILIKE '%sponsor-logos%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;