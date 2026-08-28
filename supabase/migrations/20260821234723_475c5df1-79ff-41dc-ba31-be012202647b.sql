CREATE OR REPLACE FUNCTION public.delete_my_event_series(_recurrence_group_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _deleted_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF _recurrence_group_id IS NULL THEN
    RAISE EXCEPTION 'A recurring series is required';
  END IF;

  DELETE FROM public.calendar_events
  WHERE recurrence_group_id = _recurrence_group_id
    AND submitted_by_user_id = auth.uid();

  GET DIAGNOSTICS _deleted_count = ROW_COUNT;

  IF _deleted_count = 0 THEN
    RAISE EXCEPTION 'Recurring series not found or not owned by this account';
  END IF;

  RETURN _deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_event_series(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_event_series(uuid) TO authenticated;