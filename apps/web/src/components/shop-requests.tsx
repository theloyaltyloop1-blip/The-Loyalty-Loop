import {useEffect,useRef,useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {supabase} from '@/lib/supabase'
import {Dialog,DialogContent,DialogDescription,DialogTitle} from '@/components/ui/dialog'
type Detail={place_id:string;name:string;address:string}
type Result={place:Detail;token:{payload:string;signature:string};requested:boolean;count:number}
type Mine={place_id:string;count:number;status:string;business_id:string|null;name?:string;address?:string}
export const requestStatus:Record<string,string>={collecting:'Gathering requests',ready:'Ready to invite',contacted:'Invitation underway',joined:'Now on The Loyalty Loop',declined:'Not joining yet',suppressed:'Request recorded'}
async function shopPath(id:string){const {data,error}=await supabase.from('businesses').select('slug').eq('id',id).single();if(error||!data?.slug)throw Error('Shop unavailable');return `/dashboard/shop/${data.slug}`}
export function AskShopDialog({open,onOpenChange,initialQuery=''}:{open:boolean;onOpenChange:(open:boolean)=>void;initialQuery?:string}){
 const navigate=useNavigate(),version=useRef(0)
 const [query,setQuery]=useState(initialQuery),[rows,setRows]=useState<Result[]>([]),[listed,setListed]=useState<{name:string;address:string;business_id:string}[]>([])
 const [loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('')
 useEffect(()=>{if(open){setQuery(initialQuery);setRows([]);setListed([]);setError('')}},[open,initialQuery])
 useEffect(()=>{let cancelled=false;const generation=++version.current
  if(!open||query.trim().length<2){setRows([]);setListed([]);setLoading(false);return}
  setLoading(true);setError('')
  const timer=setTimeout(async()=>{try{const {data,error:e}=await supabase.functions.invoke('shop-request-search',{body:{query:query.trim()}})
   if(cancelled||generation!==version.current)return
   if(e||data?.error)throw Error('Search unavailable')
   setRows(data.places??[]);setListed(data.listed??[])
  }catch{if(!cancelled){setRows([]);setListed([]);setError('Could not search shops. Please try again shortly.')}}finally{if(!cancelled)setLoading(false)}},400)
  return()=>{cancelled=true;clearTimeout(timer)}
 },[open,query])
 async function request(row:Result){setBusy(true);setError('');try{const {data,error:e}=await supabase.rpc('request_shop',{p_place:row.token});if(e)throw e;setRows(prev=>prev.map(r=>r.place.place_id===row.place.place_id?{...r,requested:true,count:data.count}:r))}catch{setError('Could not record your request. Search again and retry.')}finally{setBusy(false)}}
 async function view(id:string){try{const path=await shopPath(id);onOpenChange(false);navigate(path)}catch{setError('Could not open that shop. Please try again.')}}
 return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
  <DialogTitle className="font-display text-2xl">Ask them to join</DialogTitle><DialogDescription>We'll let them know local shoppers want them. If they join, we'll tell you.</DialogDescription>
  <input type="search" aria-label="Shop name and town" placeholder="Shop name and town" value={query} onChange={e=>setQuery(e.target.value)} className="h-12 rounded-xl border bg-background px-4"/>
  {loading&&<p role="status">Searching…</p>}{error&&<p role="alert" className="text-red-700">{error}</p>}
  {listed.map(row=><div key={row.business_id} className="flex items-center justify-between gap-4 border-b py-3"><div><strong>{row.name}</strong><p>{row.address}</p></div><button className="shrink-0 underline" onClick={()=>void view(row.business_id)}>View shop</button></div>)}
  {rows.map(row=><div key={row.place.place_id} className="flex items-center justify-between gap-4 border-b py-3"><div><strong>{row.place.name}</strong><p>{row.place.address}</p>{row.requested&&<p role="status">{row.count} {row.count===1?'person has':'people have'} asked</p>}</div><button disabled={row.requested||busy||loading} onClick={()=>void request(row)} className="shrink-0 rounded-xl bg-primary px-4 py-3 font-semibold text-white disabled:opacity-60">{row.requested?'Requested ✓':'Request'}</button></div>)}
  {!loading&&!error&&query.trim().length>=2&&!rows.length&&!listed.length&&<p>No shops found. Try the shop name and town.</p>}
  <p className="text-right text-xs text-[#5e5e5e]">Google Maps</p>
 </DialogContent></Dialog>
}
// Google Places names stay in memory for this page session only; never persisted.
export const shopNameCache=new Map<string,Detail>()
supabase.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')shopNameCache.clear()})
// Looks up only uncached IDs, charged to the separate details budget (never shop search).
export async function hydrateShopNames(ids:string[],limit:number){
 const missing=[...new Set(ids)].filter(id=>!shopNameCache.has(id)).slice(0,limit);if(!missing.length)return
 const {data,error}=await supabase.functions.invoke('shop-request-search',{body:{mode:'details',place_ids:missing}})
 if(!error&&data?.details)for(const d of data.details as Detail[])shopNameCache.set(d.place_id,d)
}
const named=<T extends {place_id:string}>(rows:T[])=>rows.map(row=>({...row,...shopNameCache.get(row.place_id)}))
export function RequestedShops(){
 const navigate=useNavigate(),section=useRef<HTMLElement>(null)
 const [rows,setRows]=useState<Mine[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[seen,setSeen]=useState(false)
 async function load(){const {data,error:e}=await supabase.rpc('my_shop_requests');if(e){setError('Could not load your shop requests.');return}const all:Mine[]=data??[];setRows(named(all));setError('')}
 useEffect(()=>{void load()},[])
 // Names are fetched only once the list scrolls into view.
 useEffect(()=>{const el=section.current;if(!el||seen)return
  const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setSeen(true);observer.disconnect()}});observer.observe(el);return()=>observer.disconnect()},[seen])
 useEffect(()=>{if(!seen||!rows.length)return;let cancelled=false;void hydrateShopNames(rows.map(r=>r.place_id),20).then(()=>{if(!cancelled)setRows(prev=>named(prev))});return()=>{cancelled=true}},[seen,rows.length])
 async function withdraw(id:string){setBusy(true);const {error:e}=await supabase.rpc('withdraw_shop_request',{p_place_id:id});if(e)setError('Could not withdraw your request. Please try again.');else await load();setBusy(false)}
 async function view(id:string){try{navigate(await shopPath(id))}catch{setError('Could not open that shop. Please try again.')}}
 return <section ref={section} className="mb-5 rounded-2xl bg-card p-6"><h2 className="font-display text-xl">Shops you've asked for</h2>{error&&<p role="alert">{error}</p>}{!rows.length&&!error&&<p className="mt-2 text-muted-foreground">Your requested shops will appear here.</p>}
  {rows.map(row=><div key={row.place_id} className="flex flex-wrap items-center justify-between gap-3 border-b py-4"><div><strong>{row.name??'A shop you asked for'}</strong>{row.address&&<p>{row.address}</p>}<p>{requestStatus[row.status]??'Request recorded'} · {row.count} {row.count===1?'person has':'people have'} asked</p></div>{row.business_id&&<button className="underline" onClick={()=>void view(row.business_id!)}>View shop</button>}<button disabled={busy} className="underline disabled:opacity-50" onClick={()=>void withdraw(row.place_id)}>Withdraw</button></div>)}
  {rows.some(row=>row.name)&&<p className="mt-3 text-right text-xs text-[#5e5e5e]">Google Maps</p>}
 </section>
}
