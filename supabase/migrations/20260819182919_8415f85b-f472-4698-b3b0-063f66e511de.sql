ALTER TABLE public.calendar_events
  DROP CONSTRAINT IF EXISTS calendar_events_audience_scope_chk;

ALTER TABLE public.calendar_events
  ADD CONSTRAINT calendar_events_audience_scope_chk
  CHECK (audience_scope IN ('diocese', 'multi', 'regional', 'national'));

UPDATE public.calendar_events
SET start_at = '2026-09-16 17:41:00+00'::timestamptz,
    end_at = '2026-09-18 17:41:00+00'::timestamptz
WHERE id = 'e78f18e6-2994-4bd2-b69b-99e0d711685f'
  AND lower(title) = 'lets gooooooooo';