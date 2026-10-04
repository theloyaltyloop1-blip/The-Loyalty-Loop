import {useCallback,useEffect,useState} from 'react'
import {Link,Navigate} from 'react-router-dom'
import {supabase} from '@/lib/supabase'
import {useAuth} from '@/lib/auth-context'
import {hydrateShopNames,shopNameCache} from '@/components/shop-requests'
type Shop={place_id:string;name?:string;address?:string;request_count:number;status:string;joined_business_id:string|null;email_attempted_at:string|null;email_sent_at:string|null}
type Business={id:string;name:string;slug:string}
const statuses=['collecting','ready','contacted','joined','declined','suppressed']
// The admin details limit is 50 names per lookup, so the list pages in 50s.
const PAGE=50
const withNames=(rows:Shop[])=>rows.map(row=>({...row,...shopNameCache.get(row.place_id)}))
export function ShopRequests(){
 const {session,loading,rolesLoading,roles}=useAuth()
 const [shops,setShops]=useState<Shop[]>([]),[businesses,setBusinesses]=useState<Business[]>([]),[threshold,setThreshold]=useState('5')
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[page,setPage]=useState(0)
 const load=useCallback(async()=>{
  setBusy(true);setError('')
  try{
   const [{data,error:e},{data:bs,error:be}]=await Promise.all([supabase.rpc('admin_shop_requests'),supabase.from('businesses').select('id,name,slug').eq('is_active',true).eq('approval_status','approved').order('name')])
   if(e||be)throw Error(e?.message??be?.message);const rows:Shop[]=data.shops;setShops(withNames(rows));setThreshold(String(data.threshold));setBusinesses(bs??[])
  }catch(e){setError(e instanceof Error?e.message:'Could not load requests')}finally{setBusy(false)}
 },[])
 const userId=session?.user.id, isAdmin=roles.includes('admin')
 useEffect(()=>{if(userId&&isAdmin)void load()},[userId,isAdmin,load])
 const pageIds=shops.slice(page*PAGE,(page+1)*PAGE).map(s=>s.place_id).join(',')
 useEffect(()=>{if(!pageIds)return;let cancelled=false;void hydrateShopNames(pageIds.split(','),PAGE).then(()=>{if(!cancelled)setShops(prev=>withNames(prev))});return()=>{cancelled=true}},[pageIds])
 if(loading||rolesLoading)return <p className="p-8">Loading…</p>
 if(!session)return <Navigate to="/login" replace/>
 if(!roles.includes('admin'))return <Navigate to="/dashboard" replace/>
 async function save(shop:Shop,status:string,business:string|null=null){
  setBusy(true);setError('')
  const {error:e}=await supabase.rpc('admin_set_shop_request',{p_place_id:shop.place_id,p_status:status,p_business_id:business})
  if(e){setError(e.message);setBusy(false)}else await load()
 }
 async function saveThreshold(){
  const n=Number(threshold);if(!Number.isInteger(n)||n<1||n>10000){setError('Choose a threshold between 1 and 10,000');return}
  setBusy(true);const {error:e}=await supabase.rpc('admin_set_shop_request_threshold',{p_threshold:n})
  if(e){setError(e.message);setBusy(false)}else await load()
 }
 async function retry(id:string){setBusy(true);const {error:e}=await supabase.rpc('admin_retry_shop_request',{p_place_id:id});if(e){setError('Could not queue the operator notification.');setBusy(false)}else await load()}
 return <main className="mx-auto min-h-dvh max-w-5xl p-5 sm:p-10">
  <Link to="/access" className="text-sm underline">← Access panel</Link>
  <h1 className="mt-6 font-display text-3xl font-bold">Shops shoppers want</h1>
  <p className="mt-2 text-muted-foreground">Requests are sorted by count. The operator receives a pitch when a shop reaches the threshold.</p>
  <div className="my-6 flex flex-wrap items-center gap-3"><label htmlFor="threshold">Request threshold</label><input id="threshold" type="number" min="1" max="10000" value={threshold} onChange={e=>setThreshold(e.target.value)} className="w-24 rounded-lg border bg-background p-2"/><button disabled={busy} onClick={()=>void saveThreshold()} className="rounded-lg bg-primary hover:bg-primary-hover transition-colors px-4 py-2 text-primary-foreground disabled:opacity-50">Save threshold</button><button disabled={busy} onClick={()=>void load()} className="underline">Refresh</button></div>
  {error&&<p role="alert" className="mb-4 text-destructive">{error}</p>}
  {!shops.length&&<p>{busy?'Loading requests…':'No shop requests yet.'}</p>}
  <div className="space-y-4">{shops.slice(page*PAGE,(page+1)*PAGE).map(shop=><article key={shop.place_id} className="rounded-2xl border bg-card p-5">
   <div className="flex flex-wrap justify-between gap-2"><h2 className="text-lg font-bold">{shop.name??'Requested shop'}</h2><strong>{shop.request_count} {shop.request_count===1?'person has':'people have'} asked</strong></div>
   <p className="mt-1 text-sm text-muted-foreground">{shop.address}</p>
   {shop.email_attempted_at&&!shop.email_sent_at&&<p className="mt-2 text-sm text-amber-ink dark:text-amber">Operator email delivery is unconfirmed. Check Resend before sending manually.</p>}
   {shop.status==='ready'&&!shop.email_attempted_at&&<p className="mt-2 text-sm text-amber-ink dark:text-amber">Operator email not sent. <button disabled={busy} className="underline" onClick={()=>void retry(shop.place_id)}>Send operator notification</button></p>}
   <div className="mt-4 flex flex-wrap items-center gap-3"><label>Status <select aria-label={`Status for ${shop.name}`} value={shop.status} disabled={busy||shop.status==='joined'||shop.status==='suppressed'} onChange={e=>{if(e.target.value!=='joined')void save(shop,e.target.value)}} className="ml-2 rounded-lg border bg-background p-2">{statuses.map(s=><option key={s} value={s} disabled={s==='joined'||(s==='collecting'&&shop.status!=='collecting')}>{s}</option>)}</select></label>
   {shop.status!=='joined'&&<label>Link joined business <select aria-label={`Joined business for ${shop.name}`} value="" disabled={busy} onChange={e=>{if(e.target.value)void save(shop,'joined',e.target.value)}} className="ml-2 max-w-full rounded-lg border bg-background p-2"><option value="">Choose approved shop…</option>{businesses.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>}
   {shop.joined_business_id&&businesses.find(b=>b.id===shop.joined_business_id)?.slug&&<Link className="underline" to={`/dashboard/shop/${businesses.find(b=>b.id===shop.joined_business_id)!.slug}`}>View joined shop</Link>}</div>
  </article>)}</div>
  {shops.length>PAGE&&<div className="mt-6 flex items-center justify-center gap-4"><button disabled={page===0} onClick={()=>setPage(p=>p-1)} className="underline disabled:opacity-40">Previous 50</button><span className="text-sm text-muted-foreground">Page {page+1} of {Math.ceil(shops.length/PAGE)}</span><button disabled={(page+1)*PAGE>=shops.length} onClick={()=>setPage(p=>p+1)} className="underline disabled:opacity-40">Next 50</button></div>}
  {shops.some(shop=>shop.name)&&<p className="mt-4 text-right text-xs text-muted-foreground">Google Maps</p>}
 </main>
}
