-- Update the admin email grant for the rebranded project
DELETE FROM public.user_roles
WHERE role = 'admin'
  AND user_id NOT IN (
    SELECT id FROM auth.users WHERE lower(email) = 'globalcatholiccalendar@gmail.com'
  );

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE lower(email) = 'globalcatholiccalendar@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;