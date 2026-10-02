import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {createClient} from 'jsr:@supabase/supabase-js@2';
import {searchHandler} from '../_shared/shop-requests.ts';
const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
Deno.serve(searchHandler({
 user:async jwt=>{const {data,error}=await admin.auth.getUser(jwt);return error?null:data.user?.id??null;},
 consume:async id=>{const {data,error}=await admin.rpc('consume_shop_search',{p_user_id:id});if(error)throw Error('budget unavailable');return data===true;},
 isAdmin:async id=>{const {data,error}=await admin.rpc('has_role',{_user_id:id,_role:'admin'});if(error)throw Error('role lookup failed');return data===true;},
 listed:async place=>{const {data,error}=await admin.rpc('shop_request_listed',{p_place:place});if(error)throw Error('listing lookup failed');return data;},
 mine:async id=>{
  const {data,error}=await admin.from('shop_requests').select('place_id,requested_shops(request_count)').eq('user_id',id);
  if(error)throw Error('request lookup failed');
  return (data??[]).map(r=>({place_id:r.place_id,count:(Array.isArray(r.requested_shops)?r.requested_shops[0]:r.requested_shops)?.request_count??0}));
 }
},fetch,name=>Deno.env.get(name)));
