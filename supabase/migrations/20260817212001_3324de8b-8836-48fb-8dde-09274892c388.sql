UPDATE public.organizer_profiles SET diocese_slug = 'montreal' WHERE user_id = '3066dde7-939b-4cc5-8991-e0ca8967efa9';
UPDATE public.organizer_profiles SET diocese_slug = NULL WHERE user_id = 'ae9e5b58-fddf-4d1f-aeb4-99af24de51a1';

DELETE FROM public.event_interests WHERE event_id IN (SELECT id FROM public.calendar_events WHERE submitted_by_user_id = 'd93d4965-07d4-4e53-a20a-eefcf48d1228');
DELETE FROM public.featured_slots WHERE event_id IN (SELECT id FROM public.calendar_events WHERE submitted_by_user_id = 'd93d4965-07d4-4e53-a20a-eefcf48d1228');
DELETE FROM public.calendar_events WHERE submitted_by_user_id = 'd93d4965-07d4-4e53-a20a-eefcf48d1228';
DELETE FROM public.organizer_follows WHERE organizer_user_id = 'd93d4965-07d4-4e53-a20a-eefcf48d1228' OR follower_user_id = 'd93d4965-07d4-4e53-a20a-eefcf48d1228';
DELETE FROM public.direct_messages WHERE sender_user_id = 'd93d4965-07d4-4e53-a20a-eefcf48d1228' OR recipient_user_id = 'd93d4965-07d4-4e53-a20a-eefcf48d1228';
DELETE FROM public.dm_conversation_state WHERE user_id = 'd93d4965-07d4-4e53-a20a-eefcf48d1228' OR peer_user_id = 'd93d4965-07d4-4e53-a20a-eefcf48d1228';
DELETE FROM public.discussion_replies WHERE author_user_id = 'd93d4965-07d4-4e53-a20a-eefcf48d1228';
DELETE FROM public.thread_pins WHERE thread_id IN (SELECT id FROM public.discussion_threads WHERE author_user_id = 'd93d4965-07d4-4e53-a20a-eefcf48d1228') OR user_id = 'd93d4965-07d4-4e53-a20a-eefcf48d1228';
DELETE FROM public.discussion_replies WHERE thread_id IN (SELECT id FROM public.discussion_threads WHERE author_user_id = 'd93d4965-07d4-4e53-a20a-eefcf48d1228');
DELETE FROM public.discussion_threads WHERE author_user_id = 'd93d4965-07d4-4e53-a20a-eefcf48d1228';
DELETE FROM public.organizer_profiles WHERE user_id = 'd93d4965-07d4-4e53-a20a-eefcf48d1228';
DELETE FROM auth.users WHERE id = 'd93d4965-07d4-4e53-a20a-eefcf48d1228';