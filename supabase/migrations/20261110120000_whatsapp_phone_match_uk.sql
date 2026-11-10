-- WhatsApp sends +447…; profiles may hold the UK national form 07…. Match both
-- (still only when exactly one profile matches). Service role only, as before.
create or replace function public.find_whatsapp_user_by_phone(_phone text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _matches uuid[];
  _digits text := regexp_replace(coalesce(_phone, ''), '\D', '', 'g');
begin
  if length(_digits) < 7 then
    return null;
  end if;
  select array_agg(id) into _matches
  from (
    select id
    from public.profiles
    where regexp_replace(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), '^0(?=7)', '44') = _digits
    limit 2
  ) matches;

  if coalesce(cardinality(_matches), 0) = 1 then
    return _matches[1];
  end if;
  return null;
end;
$function$;

revoke all on function public.find_whatsapp_user_by_phone(text) from public, anon, authenticated;
grant execute on function public.find_whatsapp_user_by_phone(text) to service_role;
