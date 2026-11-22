-- Lets a shopper see their own unused win-back coupons (code + shop) so the app can
-- show the code and QR in the Rewards tab. winback_email_log itself stays owner/admin
-- only; this is a read-only security-definer function limited to auth.uid().
create or replace function public.my_winback_coupons()
returns table (
  id uuid,
  business_id uuid,
  business_name text,
  brand_color text,
  coupon_code text,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id, l.business_id, b.name, b.brand_color, l.coupon_code, l.expires_at
  from public.winback_email_log l
  join public.businesses b on b.id = l.business_id
  where l.user_id = auth.uid()
    and l.status = 'sent'
    and l.redeemed_at is null
    and (l.expires_at is null or l.expires_at > now())
  order by l.sent_at desc;
$$;

revoke all on function public.my_winback_coupons() from public, anon;
grant execute on function public.my_winback_coupons() to authenticated;
