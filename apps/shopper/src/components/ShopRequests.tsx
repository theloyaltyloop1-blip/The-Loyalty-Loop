import {useCallback,useEffect,useRef,useState} from 'react'
import {ActivityIndicator,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native'
import {colors} from '@loyalty-loop/design-tokens'
import {supabase} from '../supabase'
import {Sheet} from './Sheet'
import {SuccessCheck} from './SuccessCheck'
type Place={place_id:string;name:string;address:string}
type Result={place:Place;token:{payload:string;signature:string};requested:boolean;count:number}
type Listed={name:string;address:string;business_id:string}
type Mine={place_id:string;name:string;address:string;count:number;status:string;business_id:string|null}
export function AskShopSheet({visible,onClose,initialQuery='',location,onViewShop}:{visible:boolean;onClose:()=>void;initialQuery?:string;location?:{lat:number;lng:number};onViewShop:(id:string)=>void}){
 const [query,setQuery]=useState(initialQuery),[results,setResults]=useState<Result[]>([]),[listed,setListed]=useState<Listed[]>([])
 const [loading,setLoading]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState<string|null>(null),[success,setSuccess]=useState(false)
 const generation=useRef(0),submitted=useRef(new Map<string,number>())
 useEffect(()=>{if(visible){setQuery(initialQuery);setError('');submitted.current.clear()}else{generation.current++;setResults([]);setListed([]);setSuccess(false)}},[visible,initialQuery])
 useEffect(()=>{
  const version=++generation.current;let cancelled=false
  if(!visible||query.trim().length<2){setResults([]);setListed([]);setLoading(false);return}
  setLoading(true);setError('')
  const timer=setTimeout(async()=>{
   try{
    const {data,error:e}=await supabase.functions.invoke('shop-request-search',{body:{query:query.trim(),...location}})
    if(cancelled||version!==generation.current)return
    if(e||data?.error)throw Error(data?.error??'Shop search is unavailable. Try again shortly.')
    setResults((data.places??[]).map((r:Result)=>submitted.current.has(r.place.place_id)?{...r,requested:true,count:submitted.current.get(r.place.place_id)!}:r));setListed(data.listed??[])
   }catch(e){if(!cancelled&&version===generation.current){setResults([]);setListed([]);setError(e instanceof Error?e.message:'Could not search shops')}}finally{if(!cancelled&&version===generation.current)setLoading(false)}
  },400)
  return()=>{cancelled=true;clearTimeout(timer)}
 },[visible,query,location?.lat,location?.lng])
 async function request(row:Result){
  setBusy(row.place.place_id);setError('')
  try{
   const {data,error:e}=await supabase.rpc('request_shop',{p_place:row.token});if(e)throw Error(e.message)
   submitted.current.set(row.place.place_id,data.count)
   setResults(prev=>prev.map(r=>r.place.place_id===row.place.place_id?{...r,requested:true,count:data.count}:r));setSuccess(true)
  }catch(e){setError(e instanceof Error?e.message:'Could not request this shop')}finally{setBusy(null)}
 }
 return <><Sheet visible={visible} onClose={onClose} sheetStyle={s.sheet}>
  <View style={s.handle}/><View style={s.header}><Text style={s.title}>Ask them to join</Text><Pressable accessibilityLabel="Close shop requests" onPress={onClose} hitSlop={12}><Text style={s.action}>Close</Text></Pressable></View>
  <Text style={s.copy}>We'll let them know local shoppers want them. If they join, we'll tell you.</Text>
  <TextInput accessibilityLabel="Find a shop to request" placeholder="Shop name and town" value={query} onChangeText={setQuery} style={s.input} autoCorrect={false}/>
  {loading&&<ActivityIndicator color={colors.primary}/>}{error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
  <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.rows}>
   {listed.map(row=><View key={row.business_id} style={s.row}><View style={s.details}><Text style={s.name}>{row.name}</Text><Text style={s.copy}>{row.address}</Text></View><Pressable accessibilityRole="button" onPress={()=>{onClose();onViewShop(row.business_id)}}><Text style={s.action}>View shop</Text></Pressable></View>)}
   {results.map(row=><View key={row.place.place_id} style={s.row}><View style={s.details}><Text style={s.name}>{row.place.name}</Text><Text style={s.copy}>{row.place.address}</Text>{row.requested&&<Text style={s.copy}>{row.count} {row.count===1?'person has':'people have'} asked</Text>}</View><Pressable accessibilityRole="button" disabled={row.requested||busy!==null||loading} onPress={()=>void request(row)} style={[s.button,(row.requested||busy!==null)&&s.disabled]}><Text style={s.buttonText}>{busy===row.place.place_id?'Requesting…':row.requested?'Requested ✓':'Request'}</Text></Pressable></View>)}
   {!loading&&!error&&query.trim().length>=2&&!results.length&&!listed.length&&<Text style={s.copy}>No shops found. Try the shop name and town.</Text>}
  </ScrollView>
  <Text style={s.attribution}>Google Maps</Text>
 </Sheet><SuccessCheck visible={success} onFinished={()=>setSuccess(false)}/></>
}
export function RequestedShopsList({active}:{active:boolean}){
 const [rows,setRows]=useState<Mine[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState<string|null>(null)
 const load=useCallback(async()=>{const {data,error:e}=await supabase.rpc('my_shop_requests');if(e)setError('Could not load your shop requests.');else{setRows(data??[]);setError('')}},[])
 useEffect(()=>{if(active)void load()},[active,load])
 async function withdraw(id:string){setBusy(id);const {error:e}=await supabase.rpc('withdraw_shop_request',{p_place_id:id});if(e)setError(e.message);else await load();setBusy(null)}
 return <View style={s.profile}><Text style={s.title}>Shops you've asked for</Text>{error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
  {!rows.length&&!error&&<Text style={s.copy}>When you ask a shop to join, it will appear here.</Text>}
  {rows.map(row=><View style={s.row} key={row.place_id}><View style={s.details}><Text style={s.name}>{row.name}</Text><Text style={s.copy}>{row.address}</Text><Text style={s.copy}>{row.status==='suppressed'?'Request recorded':row.status} · {row.count} {row.count===1?'person has':'people have'} asked</Text></View><Pressable accessibilityRole="button" disabled={busy!==null} onPress={()=>void withdraw(row.place_id)}><Text style={s.action}>{busy===row.place_id?'Withdrawing…':'Withdraw'}</Text></Pressable></View>)}
 </View>
}
const s=StyleSheet.create({sheet:{padding:20,maxHeight:'85%',backgroundColor:colors.background,borderTopLeftRadius:28,borderTopRightRadius:28},handle:{width:36,height:4,borderRadius:2,backgroundColor:'#bbb',alignSelf:'center',marginBottom:18},header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:10},title:{fontSize:21,fontWeight:'700',color:colors.foreground},copy:{fontSize:14,lineHeight:20,color:'#777064',marginTop:4},input:{borderWidth:1,borderColor:'#d4cec4',borderRadius:14,padding:14,fontSize:16,marginVertical:16,color:colors.foreground,backgroundColor:colors.card},rows:{paddingBottom:16},row:{flexDirection:'row',gap:12,alignItems:'center',paddingVertical:14,borderBottomWidth:1,borderBottomColor:'#e6dfd4'},details:{flex:1},name:{fontSize:16,fontWeight:'600',color:colors.foreground},action:{color:colors.primary,fontWeight:'600'},button:{borderRadius:12,padding:12,backgroundColor:colors.primary},buttonText:{color:'white',fontWeight:'700'},disabled:{opacity:0.6},error:{color:'#a52b21',marginVertical:8},attribution:{color:'#777064',fontSize:12,textAlign:'right',marginTop:10},profile:{gap:8}})
