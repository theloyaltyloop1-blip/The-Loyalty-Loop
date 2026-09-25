-- Bug fix: the original policies wrote `storage.foldername(name)` inside an
-- EXISTS subquery against `businesses b` — since businesses also has a `name`
-- column, unqualified `name` resolved to `b.name` (the shop's display name)
-- instead of `storage.objects.name` (the file path), so the folder-prefix
-- ownership check never matched anything real. Fully-qualify it.

drop policy "logos_owner_write" on storage.objects;
drop policy "logos_owner_update" on storage.objects;
drop policy "logos_owner_delete" on storage.objects;
drop policy "covers_owner_write" on storage.objects;
drop policy "covers_owner_update" on storage.objects;
drop policy "covers_owner_delete" on storage.objects;

create policy "logos_owner_write"
  on storage.objects for insert
  with check (
    bucket_id = 'logos'
    and exists (
      select 1 from public.businesses b
      where b.id::text = (storage.foldername(storage.objects.name))[1] and b.owner_id = auth.uid()
    )
  );

create policy "logos_owner_update"
  on storage.objects for update
  using (
    bucket_id = 'logos'
    and exists (
      select 1 from public.businesses b
      where b.id::text = (storage.foldername(storage.objects.name))[1] and b.owner_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'logos'
    and exists (
      select 1 from public.businesses b
      where b.id::text = (storage.foldername(storage.objects.name))[1] and b.owner_id = auth.uid()
    )
  );

create policy "logos_owner_delete"
  on storage.objects for delete
  using (
    bucket_id = 'logos'
    and exists (
      select 1 from public.businesses b
      where b.id::text = (storage.foldername(storage.objects.name))[1] and b.owner_id = auth.uid()
    )
  );

create policy "covers_owner_write"
  on storage.objects for insert
  with check (
    bucket_id = 'covers'
    and exists (
      select 1 from public.businesses b
      where b.id::text = (storage.foldername(storage.objects.name))[1] and b.owner_id = auth.uid()
    )
  );

create policy "covers_owner_update"
  on storage.objects for update
  using (
    bucket_id = 'covers'
    and exists (
      select 1 from public.businesses b
      where b.id::text = (storage.foldername(storage.objects.name))[1] and b.owner_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'covers'
    and exists (
      select 1 from public.businesses b
      where b.id::text = (storage.foldername(storage.objects.name))[1] and b.owner_id = auth.uid()
    )
  );

create policy "covers_owner_delete"
  on storage.objects for delete
  using (
    bucket_id = 'covers'
    and exists (
      select 1 from public.businesses b
      where b.id::text = (storage.foldername(storage.objects.name))[1] and b.owner_id = auth.uid()
    )
  );
