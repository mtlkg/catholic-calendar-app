create or replace function public.admin_stats(_diocese_slugs text[] default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
  use_filter boolean := _diocese_slugs is not null and array_length(_diocese_slugs, 1) > 0;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'not authorized';
  end if;

  with ev as (
    select * from public.calendar_events e
    where not use_filter or e.diocese_slug = any(_diocese_slugs)
  ), org as (
    select * from public.organizer_profiles o
    where not use_filter or o.diocese_slug = any(_diocese_slugs)
  ), th as (
    select * from public.discussion_threads t
    where not use_filter or t.diocese_slug = any(_diocese_slugs)
  )
  select jsonb_build_object(
    'organizers', (select jsonb_build_object(
        'total', count(*),
        'approved', count(*) filter (where status = 'approved'),
        'pending', count(*) filter (where status = 'pending'),
        'suspended', count(*) filter (where status = 'suspended'),
        'new30d', count(*) filter (where created_at > now() - interval '30 days')
      ) from org),
    'events', (select jsonb_build_object(
        'total', count(*),
        'approved', count(*) filter (where status = 'approved'),
        'pending', count(*) filter (where status = 'pending'),
        'rejected', count(*) filter (where status = 'rejected'),
        'upcoming', count(*) filter (where status = 'approved' and coalesce(end_at, start_at) >= now()),
        'past', count(*) filter (where coalesce(end_at, start_at) < now()),
        'new30d', count(*) filter (where created_at > now() - interval '30 days'),
        'next30d', count(*) filter (where status = 'approved' and start_at between now() and now() + interval '30 days'),
        'featured', count(*) filter (where is_featured),
        'free', count(*) filter (where is_free),
        'guestSubmitted', count(*) filter (where submitted_by_user_id is null)
      ) from ev),
    'eventsByCategory', (select coalesce(jsonb_object_agg(category, c), '{}'::jsonb)
        from (select category::text as category, count(*) as c from ev group by 1 order by 2 desc) x),
    'eventsByDiocese', (select coalesce(jsonb_object_agg(coalesce(diocese_slug, 'unassigned'), c), '{}'::jsonb)
        from (select diocese_slug, count(*) as c from ev group by 1 order by 2 desc limit 25) y),
    'eventsByMonth', (select coalesce(jsonb_object_agg(m, c), '{}'::jsonb)
        from (select to_char(date_trunc('month', created_at), 'YYYY-MM') as m, count(*) as c
              from ev where created_at > now() - interval '12 months' group by 1) z),
    'engagement', jsonb_build_object(
        'follows', (select count(*) from public.organizer_follows f
                    where not use_filter or exists (
                      select 1 from org o where o.user_id = f.organizer_user_id)),
        'follows30d', (select count(*) from public.organizer_follows f
                    where f.created_at > now() - interval '30 days'
                      and (not use_filter or exists (select 1 from org o where o.user_id = f.organizer_user_id))),
        'interests', (select count(*) from public.event_interests i
                    where not use_filter or exists (select 1 from ev e where e.id = i.event_id)),
        'interests30d', (select count(*) from public.event_interests i
                    where i.created_at > now() - interval '30 days'
                      and (not use_filter or exists (select 1 from ev e where e.id = i.event_id))),
        'pushSubscriptions', (select count(*) from public.push_subscriptions)
      ),
    'community', jsonb_build_object(
        'threads', (select count(*) from th),
        'threads30d', (select count(*) from th where created_at > now() - interval '30 days'),
        'replies', (select count(*) from public.discussion_replies r
                    where not use_filter or exists (select 1 from th t where t.id = r.thread_id)),
        'directMessages', (select count(*) from public.direct_messages m
                    where not use_filter or m.diocese_slug = any(_diocese_slugs)),
        'directMessages30d', (select count(*) from public.direct_messages m
                    where m.created_at > now() - interval '30 days'
                      and (not use_filter or m.diocese_slug = any(_diocese_slugs)))
      ),
    'emails', jsonb_build_object(
        'sent30d', (select count(*) from public.email_send_log
                    where status = 'sent' and created_at > now() - interval '30 days'),
        'bounced30d', (select count(*) from public.email_send_log
                    where status in ('bounced','failed') and created_at > now() - interval '30 days'),
        'suppressed', (select count(*) from public.suppressed_emails)
      ),
    'topOrganizers', (select coalesce(jsonb_agg(jsonb_build_object('name', name, 'events', c) order by c desc), '[]'::jsonb)
        from (
          select coalesce(o.org_name, e.guest_name, 'Unknown') as name, count(*) as c
          from ev e left join public.organizer_profiles o on o.user_id = e.submitted_by_user_id
          group by 1 order by 2 desc limit 10
        ) w)
  ) into result;

  return result;
end;
$$;

grant execute on function public.admin_stats(text[]) to authenticated;