-- Public bucket for platform brand assets (e.g. email logo). Writes are service-role only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand', 'brand', true, 1048576, array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do nothing;

create policy "brand_public_read"
  on storage.objects for select
  using (bucket_id = 'brand');
