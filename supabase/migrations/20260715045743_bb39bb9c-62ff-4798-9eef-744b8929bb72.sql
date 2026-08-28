REVOKE SELECT (guest_email, guest_name) ON public.calendar_events FROM anon, authenticated;
REVOKE SELECT (contact_email, contact_phone) ON public.organizer_profiles FROM anon, authenticated;