-- §3 Brand images: public, image-only, size-capped storage buckets for shop
-- logos/covers. Path convention: {business_id}/{filename}. See
-- docs/LOYALTY-LOOP-DATA-MODEL.md §8.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('logos', 'logos', true, 5242880, array['image/png','image/jpeg','image/webp','image/gif']),
  ('covers', 'covers', true, 5242880, array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do nothing;

create policy "logos_public_read"
  on storage.objects for select
  using (bucket_id = 'logos');

create policy "covers_public_read"
  on storage.objects for select
  using (bucket_id = 'covers');

create policy "logos_owner_write"
  on storage.objects for insert
  with check (
    bucket_id = 'logos'
    and exists (
      select 1 from public.businesses b
      where b.id::text = (storage.foldername(name))[1] and b.owner_id = auth.uid()
    )
  );

create policy "logos_owner_update"
  on storage.objects for update
  using (
    bucket_id = 'logos'
    and exists (
      select 1 from public.businesses b
      where b.id::text = (storage.foldername(name))[1] and b.owner_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'logos'
    and exists (
      select 1 from public.businesses b
      where b.id::text = (storage.foldername(name))[1] and b.owner_id = auth.uid()
    )
  );

create policy "logos_owner_delete"
  on storage.objects for delete
  using (
    bucket_id = 'logos'
    and exists (
      select 1 from public.businesses b
      where b.id::text = (storage.foldername(name))[1] and b.owner_id = auth.uid()
    )
  );

create policy "covers_owner_write"
  on storage.objects for insert
  with check (
    bucket_id = 'covers'
    and exists (
      select 1 from public.businesses b
      where b.id::text = (storage.foldername(name))[1] and b.owner_id = auth.uid()
    )
  );

create policy "covers_owner_update"
  on storage.objects for update
  using (
    bucket_id = 'covers'
    and exists (
      select 1 from public.businesses b
      where b.id::text = (storage.foldername(name))[1] and b.owner_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'covers'
    and exists (
      select 1 from public.businesses b
      where b.id::text = (storage.foldername(name))[1] and b.owner_id = auth.uid()
    )
  );

create policy "covers_owner_delete"
  on storage.objects for delete
  using (
    bucket_id = 'covers'
    and exists (
      select 1 from public.businesses b
      where b.id::text = (storage.foldername(name))[1] and b.owner_id = auth.uid()
    )
  );
