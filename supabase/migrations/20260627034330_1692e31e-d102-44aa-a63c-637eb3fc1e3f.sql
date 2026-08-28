
-- 1) calendar_events: drop broad public policy, expose via view
DROP POLICY IF EXISTS "Approved events are public" ON public.calendar_events;

CREATE OR REPLACE VIEW public.calendar_events_public
WITH (security_invoker = false) AS
SELECT id, title, description, category, category_other, start_at, end_at, all_day,
       venue_name, address, latitude, longitude, parish, is_free, price_note,
       registration_url, submitted_by_user_id, guest_name, status,
       created_at, updated_at, is_featured
FROM public.calendar_events
WHERE status = 'approved';

GRANT SELECT ON public.calendar_events_public TO anon, authenticated;

-- 2) organizer_profiles: drop broad public policy, expose via view
DROP POLICY IF EXISTS "Approved organizer profiles are public" ON public.organizer_profiles;

CREATE OR REPLACE VIEW public.organizer_profiles_public
WITH (security_invoker = false) AS
SELECT id, user_id, org_name, parish, description, categories,
       website_url, logo_url, status, created_at, updated_at
FROM public.organizer_profiles
WHERE status = 'approved';

GRANT SELECT ON public.organizer_profiles_public TO anon, authenticated;

-- 3) storage.objects UPDATE policy for chat-uploads
DROP POLICY IF EXISTS "Owners can update their chat files" ON storage.objects;
CREATE POLICY "Owners can update their chat files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'chat-uploads'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
)
WITH CHECK (
  bucket_id = 'chat-uploads'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);

-- 4) Function hardening: set search_path and revoke public execute
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.restore_inventory_on_delete() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_grand_prize_inventory() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- 5) Drop legacy always-true policies on removed e-commerce tables
DROP POLICY IF EXISTS "Anyone can submit RSVP" ON public.dinner_rsvps;
DROP POLICY IF EXISTS "Service role can update dinner rsvps" ON public.dinner_rsvps;
DROP POLICY IF EXISTS "Service role can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Service role can update orders" ON public.orders;
DROP POLICY IF EXISTS "Service role can insert tickets" ON public.tickets;
