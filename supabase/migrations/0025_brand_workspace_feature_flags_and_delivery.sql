create table public.business_feature_settings (business_id uuid primary key references public.businesses(id) on delete cascade, analytics_enabled boolean not null default true, promotions_enabled boolean not null default true, reviews_enabled boolean not null default true, disabled_message text, updated_at timestamptz not null default now());
alter table public.business_feature_settings enable row level security;
create policy "feature_settings_owner_admin_read" on public.business_feature_settings for select to authenticated using (exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=auth.uid()) or public.has_role(auth.uid(),'admin'));
create policy "feature_settings_admin_write" on public.business_feature_settings for all to authenticated using(public.has_role(auth.uid(),'admin')) with check(public.has_role(auth.uid(),'admin'));
grant select,insert,update on public.business_feature_settings to authenticated;
create trigger set_updated_at before update on public.business_feature_settings for each row execute function public.update_updated_at_column();
