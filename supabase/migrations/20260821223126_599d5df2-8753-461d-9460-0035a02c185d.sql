WITH series AS (
  SELECT submitted_by_user_id, title, coalesce(venue_name,'') AS v,
         (start_at AT TIME ZONE 'UTC')::time AS tod,
         gen_random_uuid() AS gid
  FROM public.calendar_events
  WHERE recurrence_group_id IS NULL AND submitted_by_user_id IS NOT NULL
  GROUP BY 1,2,3,4
  HAVING count(*) > 1
)
UPDATE public.calendar_events e
SET recurrence_group_id = s.gid
FROM series s
WHERE e.recurrence_group_id IS NULL
  AND e.submitted_by_user_id = s.submitted_by_user_id
  AND e.title = s.title
  AND coalesce(e.venue_name,'') = s.v
  AND (e.start_at AT TIME ZONE 'UTC')::time = s.tod;