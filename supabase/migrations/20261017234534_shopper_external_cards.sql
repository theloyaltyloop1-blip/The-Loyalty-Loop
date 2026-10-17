create table public.shopper_external_cards (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 brand_key text not null check (brand_key in ('nectar','tesco','boots','morrisons','superdrug','waitrose','ikea','other')),
 label text not null check (char_length(btrim(label)) between 1 and 40),
 card_number text not null check (char_length(card_number) between 4 and 64 and card_number !~ '[[:space:][:cntrl:]]'),
 barcode_format text not null check (barcode_format in ('ean13','ean8','code128','code39','qr','pdf417','itf14','upc_a')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(user_id,brand_key,card_number)
);
alter table public.shopper_external_cards enable row level security;
revoke all on public.shopper_external_cards from anon, authenticated;
grant select,insert,update,delete on public.shopper_external_cards to authenticated;
grant all on public.shopper_external_cards to service_role;
create policy own_cards on public.shopper_external_cards to authenticated
 using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Lock a stable parent row to serialize concurrent inserts for the same owner.
-- Invoker rights retain RLS. Ownership is immutable, including for service writers.
create function public.guard_shopper_external_cards() returns trigger
language plpgsql set search_path = '' as $$
begin
 if TG_OP = 'UPDATE' then
  if new.user_id <> old.user_id or new.id <> old.id then
   raise exception 'Card ownership cannot change';
  end if;
  new.created_at := old.created_at;
 else
  perform 1 from public.profiles where id = new.user_id for update;
  if not found then raise exception 'Card owner profile required'; end if;
  if (select count(*) from public.shopper_external_cards where user_id = new.user_id) >= 30 then
   raise exception 'Card wallet limit reached';
  end if;
 end if;
 new.updated_at := now();
 return new;
end $$;
create trigger guard_shopper_external_cards before insert or update on public.shopper_external_cards
 for each row execute function public.guard_shopper_external_cards();
revoke all on function public.guard_shopper_external_cards() from public;
