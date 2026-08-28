DO $$
DECLARE ids uuid[];
BEGIN
  SELECT array_agg(user_id) INTO ids FROM public.organizer_profiles
   WHERE contact_email LIKE '%@demo.thecatholiccalendar.org';

  DELETE FROM public.event_interests WHERE event_id IN (
    SELECT id FROM public.calendar_events
     WHERE submitted_by_user_id = ANY(ids)
        OR guest_email LIKE '%@demo.thecatholiccalendar.org'
  ) OR email LIKE '%@demo.thecatholiccalendar.org';

  DELETE FROM public.calendar_events
   WHERE submitted_by_user_id = ANY(ids)
      OR guest_email LIKE '%@demo.thecatholiccalendar.org';

  DELETE FROM public.organizer_follows
   WHERE organizer_user_id = ANY(ids)
      OR follower_user_id = ANY(ids)
      OR follower_email LIKE '%@demo.thecatholiccalendar.org';

  DELETE FROM public.direct_messages WHERE sender_user_id = ANY(ids) OR recipient_user_id = ANY(ids);
  DELETE FROM public.dm_conversation_state WHERE user_id = ANY(ids) OR peer_user_id = ANY(ids);
  DELETE FROM public.discussion_replies WHERE author_user_id = ANY(ids)
     OR thread_id IN (SELECT id FROM public.discussion_threads WHERE author_user_id = ANY(ids));
  DELETE FROM public.thread_pins WHERE user_id = ANY(ids)
     OR thread_id IN (SELECT id FROM public.discussion_threads WHERE author_user_id = ANY(ids));
  DELETE FROM public.discussion_threads WHERE author_user_id = ANY(ids);

  DELETE FROM public.organizer_profiles WHERE user_id = ANY(ids);
  DELETE FROM public.user_roles WHERE user_id = ANY(ids);
  DELETE FROM auth.users WHERE id = ANY(ids);
END $$;