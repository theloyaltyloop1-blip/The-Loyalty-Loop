export type Place = {place_id:string;name:string;address:string;postcode:string|null;lat:number;lng:number;website:string|null;phone:string|null;primary_type:string|null;country:'GB'};
export type PlaceToken = {payload:string;signature:string};
export async function signPlace(place:Place,userId:string,secret:string,now=Date.now()):Promise<PlaceToken> {
  const payload=JSON.stringify({...place,user_id:userId,expires_at:Math.floor(now/1000)+600});
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(payload)));
  return {payload,signature:[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('')};
}
export const PLACES_MASK='places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.addressComponents';
export const DETAILS_MASK='id,displayName,formattedAddress,location,primaryType,addressComponents';
export async function placeDetails(id:string,fetchFn:typeof fetch,key:string,contacts=false):Promise<Place|null>{
 const response=await fetchFn(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}?languageCode=en-GB`,{headers:{'X-Goog-Api-Key':key,'X-Goog-FieldMask':DETAILS_MASK+(contacts?',websiteUri,nationalPhoneNumber':'')},signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error('Details unavailable');return readPlace(await response.json());
}
type GooglePlace={id?:string;displayName?:{text?:string};formattedAddress?:string;location?:{latitude?:number;longitude?:number};websiteUri?:string;nationalPhoneNumber?:string;primaryType?:string;addressComponents?:{types?:string[];shortText?:string}[]};
export function readPlace(p:GooglePlace):Place|null {
  if(p.addressComponents?.find(c=>c.types?.includes('country'))?.shortText!=='GB') return null;
  const lat=p.location?.latitude,lng=p.location?.longitude;
  if(!p.id||!p.displayName?.text||!p.formattedAddress||typeof lat!=='number'||typeof lng!=='number'||!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180) return null;
  return {place_id:p.id,name:p.displayName.text.slice(0,300),address:p.formattedAddress.slice(0,1000),lat,lng,country:'GB',
    postcode:p.addressComponents?.find(c=>c.types?.includes('postal_code'))?.shortText??null,
    website:p.websiteUri?.startsWith('https://')||p.websiteUri?.startsWith('http://')?p.websiteUri.slice(0,2000):null,
    phone:p.nationalPhoneNumber?.slice(0,100)??null,primary_type:p.primaryType?.slice(0,100)??null};
}
export type SearchStore={user:(jwt:string)=>Promise<string|null>;consume:(id:string)=>Promise<boolean>;consumeDetails:(id:string,count:number,admin:boolean)=>Promise<boolean>;listed:(place:Place)=>Promise<string|null>;mine:(id:string)=>Promise<{place_id:string;count:number}[]>;isAdmin?:(id:string)=>Promise<boolean>};
export const shopCors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
export function searchHandler(store:SearchStore,fetchFn:typeof fetch,env:(name:string)=>string|undefined) {
 return async(req:Request):Promise<Response>=>{
  const json=(v:unknown,status=200)=>Response.json(v,{status,headers:shopCors});
  if(req.method==='OPTIONS')return new Response(null,{headers:shopCors});
  if(req.method!=='POST')return json({error:'method not allowed'},405);
  try {
   const jwt=req.headers.get('authorization')?.replace(/^Bearer /,'');const userId=jwt?await store.user(jwt):null;
   if(!userId)return json({error:'not authenticated'},401);
   const input=await req.json();const q=typeof input.query==='string'?input.query.trim():'';
   if(input.mode!=='details'&&(q.length<2||q.length>200))return json({error:'Enter 2–200 characters'},400);
   const key=env('GOOGLE_PLACES_API_KEY'),secret=env('SHOP_REQUEST_SIGNING_SECRET');
   if(!key||!secret)return json({error:'Shop search is not available yet'},503);
   if(input.mode==='details'){
    const admin=await store.isAdmin?.(userId)??false;
    if(!Array.isArray(input.place_ids)||input.place_ids.length>(admin?50:20)||input.place_ids.some((id:unknown)=>typeof id!=='string'||id.length<1||id.length>255))return json({error:'Invalid requested shops'},400);
    const ids=[...new Set(input.place_ids as string[])];
    if(!admin){const own=new Set((await store.mine(userId)).map(p=>p.place_id));if(ids.some(id=>!own.has(id)))return json({error:'Not allowed'},403);}
    // Reserve every provider lookup from the separate details budget, never the search caps.
    if(ids.length&&!await store.consumeDetails(userId,ids.length,admin))return json({error:'Shop names are unavailable right now'},429);
    const details=[];for(const id of ids){try{const place=await placeDetails(id,fetchFn,key);if(place)details.push({place_id:place.place_id,name:place.name,address:place.address});}catch{/* One obsolete place must not hide the others. */}}
    return json({details,attribution:'Google Maps'});
   }
   if(!await store.consume(userId))return json({error:'Daily shop search limit reached'},429);
   const lat=input.lat,lng=input.lng;
   const location=typeof lat==='number'&&typeof lng==='number'&&Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180?
    {locationBias:{circle:{center:{latitude:lat,longitude:lng},radius:10000}}}:{};
   const response=await fetchFn('https://places.googleapis.com/v1/places:searchText',{method:'POST',
     headers:{'Content-Type':'application/json','X-Goog-Api-Key':key,'X-Goog-FieldMask':PLACES_MASK},
     body:JSON.stringify({textQuery:q,regionCode:'GB',languageCode:'en-GB',pageSize:20,...location}),signal:AbortSignal.timeout(10000)});
   if(!response.ok)return json({error:'Shop search is temporarily unavailable'},502);
   const result=await response.json();const mine=new Map((await store.mine(userId)).map(p=>[p.place_id,p.count]));
   const places=[],listed=[];
   for(const raw of (result.places??[]).slice(0,20)) {
    const place=readPlace(raw);if(!place)continue;
    const business=await store.listed(place);
    if(business){listed.push({name:place.name,address:place.address,business_id:business});continue;}
    places.push({place,token:await signPlace(place,userId,secret),requested:mine.has(place.place_id),count:mine.get(place.place_id)??0});
   }
   return json({places,listed,attribution:'Google Maps'});
  } catch {return json({error:'Shop search is temporarily unavailable'},500);}
 };
}
export type ReadyShop=Partial<Place>&{place_id:string;request_count:number;ready_at:string};
export async function operatorEmail(shop:ReadyShop,baseUrl:string) {
 const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(shop.place_id)));
 const ref=[...hash].map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,20);
 const link=`${baseUrl.replace(/\/$/,'')}/join?ref=req_${ref}`;
 const name=shop.name??`shop ${shop.place_id}`;
 const demand=`${shop.request_count} local ${shop.request_count===1?'shopper has':'shoppers have'} asked`;
 const maps=`https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(shop.place_id)}`;
 const pitch=`Hello${shop.name?' '+shop.name:''},\n\n${demand} for ${name} on The Loyalty Loop. It's a simple way for independent shops to reward repeat visits with £ spend rewards.\n\nIf you'd like to join, you can get started here: ${link}\n\nThe Loyalty Loop`;
 return {subject:`${demand} for ${name}`.replace(/[\r\n]/g,' '),
  text:`Ready shop request\n\n${name}\n${shop.address??'Details unavailable; open Google Maps below.'}\nPostcode: ${shop.postcode??'Not supplied'}\nLocation: ${shop.lat!=null&&shop.lng!=null?`${shop.lat}, ${shop.lng}`:'Not supplied'}\nType: ${shop.primary_type??'Not supplied'}\nWebsite: ${shop.website??'Not supplied'}\nPhone: ${shop.phone??'Not supplied'}\nGoogle Places ID: ${shop.place_id}\nGoogle Maps: ${maps}\nRequest count: ${shop.request_count}\n\nReady-to-send pitch (choose how to reach the shop):\n\n${pitch}`,
  idempotencyKey:`shop-request-${ref}-${Date.parse(shop.ready_at)}`};
}
