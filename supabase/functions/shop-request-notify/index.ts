import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {createClient} from 'jsr:@supabase/supabase-js@2';
import {notifyHandler} from '../_shared/shop-request-notify.ts';
import {placeDetails,type ReadyShop} from '../_shared/shop-requests.ts';
const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
Deno.serve(notifyHandler({
 details:async id=>{const key=Deno.env.get('GOOGLE_PLACES_API_KEY');if(!key)throw Error('details not configured');return await placeDetails(id,fetch,key,true) as ReadyShop|null;},
 claim:async id=>{const {data,error}=await admin.rpc('claim_shop_request_notify',{p_place_id:id});if(error)throw Error('claim failed');return data;},
 current:async id=>{const {data,error}=await admin.from('requested_shops').select('*').eq('place_id',id).single();if(error)throw Error('shop lookup failed');return data;},
 finish:async(id,lease,sent)=>{const {error}=await admin.rpc('finish_shop_request_notify',{p_place_id:id,p_lease:lease,p_sent:sent});if(error)throw Error('finish failed');},
 joined:async id=>{
  const {data:shop,error:se}=await admin.from('requested_shops').select('status').eq('place_id',id).single();if(se)throw Error('shop lookup failed');if(shop.status!=='joined')return [];
  const {data,error}=await admin.from('shop_requests').select('joined_notification_id').eq('place_id',id).is('joined_push_claimed_at',null).not('joined_notification_id','is',null);
  if(error)throw Error('request lookup failed');return(data??[]).map(v=>v.joined_notification_id);
 }
},fetch,name=>Deno.env.get(name)));
