import {sameSecret} from './whatsapp-dispatch.ts';
import {operatorEmail,type ReadyShop} from './shop-requests.ts';
export type NotifyShop=ReadyShop&{status:string;lease?:string};
export type NotifyStore={begin:(id:string)=>Promise<{attempt:number}|null>;claim:(id:string)=>Promise<NotifyShop|null>;current:(id:string)=>Promise<NotifyShop>;details:(id:string)=>Promise<ReadyShop|null>;finish:(id:string,lease:string,sent:boolean)=>Promise<void>;joined:(id:string)=>Promise<string[]>};
export function notifyHandler(store:NotifyStore,fetchFn:typeof fetch,env:(name:string)=>string|undefined){
 return async(req:Request):Promise<Response>=>{
  if(req.method!=='POST')return new Response('method not allowed',{status:405});
  const secret=env('SHOP_REQUEST_NOTIFY_SECRET');
  if(!await sameSecret(secret,req.headers.get('authorization')))return new Response('unauthorized',{status:401});
  try{
   const {place_id,mode}=await req.json();if(typeof place_id!=='string'||place_id.length>255)return Response.json({error:'invalid place'},{status:400});
   if(mode==='joined'){
    const ids=await store.joined(place_id);
    let failed=0;for(const id of ids){try{const r=await fetchFn(`${env('SUPABASE_URL')}/functions/v1/send-user-push`,{method:'POST',
     headers:{'Content-Type':'application/json',Authorization:`Bearer ${env('SUPABASE_SERVICE_ROLE_KEY')}`,'x-shop-request-secret':secret!},
     body:JSON.stringify({notification_id:id}),signal:AbortSignal.timeout(15000)});if(!r.ok)failed++;}catch{failed++;}}
    return Response.json({processed:ids.length-failed,failed},{status:failed?207:200});
   }
   const reservation=await store.begin(place_id);if(!reservation)return Response.json({skipped:true});
   const key=env('RESEND_API_KEY');if(!key)return Response.json({error:'email not configured'},{status:503});
   // Details are optional. No provider call after the bounded final attempt.
   let details:ReadyShop|null=null;
   if(reservation.attempt<5){try{details=await store.details(place_id);}catch{/* Use the bounded fallback below. */}}
   if(!details&&reservation.attempt<3)return Response.json({error:'shop details unavailable; retry scheduled'},{status:502});
   const shop=await store.claim(place_id);if(!shop)return Response.json({skipped:true});
   const current=await store.current(place_id);
   if(current.status!=='ready'){await store.finish(place_id,shop.lease!,false);return Response.json({skipped:true});}
   const mail=await operatorEmail({...current,...details,request_count:current.request_count,ready_at:current.ready_at},env('APP_BASE_URL')??'https://www.the-loyalty-loop.com');
   const r=await fetchFn('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':mail.idempotencyKey},
    body:JSON.stringify({from:env('RESEND_FROM_EMAIL')??'The Loyalty Loop <onboarding@resend.dev>',
      to:[env('SHOP_REQUEST_OPERATOR_EMAIL')??'developer@the-loyalty-loop.com'],subject:mail.subject,text:mail.text}),signal:AbortSignal.timeout(15000)});
   await store.finish(place_id,shop.lease!,r.ok);return Response.json({sent:r.ok},{status:r.ok?200:502});
  }catch{return Response.json({error:'notification failed'},{status:500});}
 };
}
