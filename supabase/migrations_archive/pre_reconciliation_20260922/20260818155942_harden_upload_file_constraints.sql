-- Defence in depth for every browser-uploaded file. Bucket constraints are
-- checked by the Storage API; RLS also requires a matching safe extension.
update storage.buckets
set file_size_limit = case id
    when 'owner_verification_docs' then 10485760
    else 5242880
  end,
  allowed_mime_types = case id
    when 'owner_verification_docs' then array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']::text[]
    else array['image/png', 'image/jpeg', 'image/webp', 'image/gif']::text[]
  end
where id in ('logos', 'covers', 'gallery', 'owner_verification_docs');

alter policy "logos_owner_write" on storage.objects
  with check (
    bucket_id = 'logos'
    and lower(storage.extension(name)) in ('png', 'jpg', 'jpeg', 'webp', 'gif')
    and exists (
      select 1 from public.businesses b
      where b.id::text = (storage.foldername(storage.objects.name))[1]
        and b.owner_id = auth.uid()
    )
  );

alter policy "covers_owner_write" on storage.objects
  with check (
    bucket_id = 'covers'
    and lower(storage.extension(name)) in ('png', 'jpg', 'jpeg', 'webp', 'gif')
    and exists (
      select 1 from public.businesses b
      where b.id::text = (storage.foldername(storage.objects.name))[1]
        and b.owner_id = auth.uid()
    )
  );

alter policy "gallery_owner_write" on storage.objects
  with check (
    bucket_id = 'gallery'
    and lower(storage.extension(name)) in ('png', 'jpg', 'jpeg', 'webp', 'gif')
    and exists (
      select 1 from public.businesses b
      where b.id::text = (storage.foldername(storage.objects.name))[1]
        and b.owner_id = auth.uid()
    )
  );

alter policy "verification_docs_owner_write" on storage.objects
  with check (
    bucket_id = 'owner_verification_docs'
    and lower(storage.extension(name)) in ('png', 'jpg', 'jpeg', 'webp', 'pdf')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
