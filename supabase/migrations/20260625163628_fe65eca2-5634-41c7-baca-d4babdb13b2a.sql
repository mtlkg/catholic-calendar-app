ALTER TYPE public.event_category ADD VALUE IF NOT EXISTS 'young_adults';
ALTER TYPE public.event_category ADD VALUE IF NOT EXISTS 'youth_group';

-- Commit enum additions before using them
COMMIT;
BEGIN;

UPDATE public.calendar_events SET category = 'youth_group' WHERE category = 'youth';

-- Migrate any organizer profiles that listed "youth" as a focus area
UPDATE public.organizer_profiles
SET categories = array_replace(categories, 'youth', 'youth_group')
WHERE 'youth' = ANY(categories);

-- Ensure only sacredheartsocials@gmail.com has the admin role
DELETE FROM public.user_roles
WHERE role = 'admin'
  AND user_id NOT IN (
    SELECT id FROM auth.users WHERE lower(email) = 'sacredheartsocials@gmail.com'
  );

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE lower(email) = 'sacredheartsocials@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;