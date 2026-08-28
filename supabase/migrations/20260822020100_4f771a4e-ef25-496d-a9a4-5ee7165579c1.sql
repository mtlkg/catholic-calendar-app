alter table public.calendar_events disable trigger calendar_events_prevent_owner_status_change;
alter table public.calendar_events disable trigger trg_notify_followers_on_event_approved;
update public.calendar_events set status = 'approved' where title like '[DEMO]%';
alter table public.calendar_events enable trigger calendar_events_prevent_owner_status_change;
alter table public.calendar_events enable trigger trg_notify_followers_on_event_approved;