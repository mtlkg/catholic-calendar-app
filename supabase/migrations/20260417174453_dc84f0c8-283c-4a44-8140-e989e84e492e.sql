
insert into storage.buckets (id, name, public)
values ('sponsor-logos', 'sponsor-logos', true)
on conflict (id) do nothing;

create policy "Public can view sponsor logos"
on storage.objects for select
using (bucket_id = 'sponsor-logos');

create policy "Service role can upload sponsor logos"
on storage.objects for insert
to service_role
with check (bucket_id = 'sponsor-logos');

create policy "Service role can update sponsor logos"
on storage.objects for update
to service_role
using (bucket_id = 'sponsor-logos');

create policy "Service role can delete sponsor logos"
on storage.objects for delete
to service_role
using (bucket_id = 'sponsor-logos');
