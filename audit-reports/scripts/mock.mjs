const now=new Date().toISOString();const UID='00000000-0000-0000-0000-000000000001';
const user={id:UID,aud:'authenticated',role:'authenticated',email:'audit@example.com',user_metadata:{first_name:'Audit'},app_metadata:{},created_at:now};
export const session={access_token:'x.y.z',token_type:'bearer',expires_in:999999,expires_at:Math.floor(Date.now()/1000)+999999,refresh_token:'r',user};
const biz={id:'b1',owner_id:UID,name:'The Very Long Named Neighbourhood Coffee Roastery & Bakery',slug:'b1',category:'Coffee',description:'A friendly local café serving speciality coffee, pastries and brunch all week long with a very long description to stress wrapping.',address:'123 Extraordinarily Long High Street Name, Tooting',postcode:'SW17 0AA',website:'https://example.com',phone:'0207 000 0000',instagram:'coffee',brand_color:'#c2410c',logo_url:null,cover_url:null,opening_hours:null,loyalty_type:'stamp_card',loyalty_config:{stamps_required:10,stamp_icon:'coffee',signup_reward_title:'Free flat white'},verification_status:'verified',is_active:true,status:'active',created_at:now};
const row=(i)=>({...biz,id:'r'+i,user_id:UID,business_id:'b1',business:biz,businesses:biz,role:'business_owner',title:'Announcement title number '+i+' with extra words for wrap testing',body:'Body text for row '+i+' — lorem ipsum dolor sit amet, consectetur adipiscing elit.',subject:'Support subject '+i,priority:'normal',rating:4,reply:null,stamp_count:i,points_balance:i*10,visit_count:i,first_name:'Customer',last_name:'Number'+i,joined_at:now,created_at:now,updated_at:now,last_activity_at:now,read_at:i%2?now:null,type:'stamp',amount:1,cost:5,stamps_required:10,points_required:100,redeemed_at:null,expires_at:null,code:'ABC12'+i,link:null,email:'c'+i+'@example.com',display_name:'Customer '+i});
export async function install(ctx){
 await ctx.addInitScript(s=>{localStorage.setItem('sb-127-auth-token',JSON.stringify(s));localStorage.setItem('loyalty-loop-cookie-choice','all')},session);
 await ctx.route(/127\.0\.0\.1:9\//,async route=>{const u=new URL(route.request().url());const p=u.pathname;const h={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-expose-headers':'content-range','content-type':'application/json'};
  if(route.request().method()==='OPTIONS')return route.fulfill({status:200,headers:h,body:''});
  if(p.startsWith('/auth/v1/user'))return route.fulfill({headers:h,body:JSON.stringify(user)});
  if(p.startsWith('/auth/v1'))return route.fulfill({headers:h,body:JSON.stringify(session)});
  if(p.startsWith('/rest/v1/user_roles'))return route.fulfill({headers:h,body:JSON.stringify((process.env.ROLES||'consumer').split(',').map(role=>({role})))});
  const rows=[1,2,3].map(row);const single=(route.request().headers()['accept']||'').includes('vnd.pgrst.object');
  if(p.startsWith('/rest/v1/rpc'))return route.fulfill({headers:h,body:'[]'});
  if(p.startsWith('/rest/v1/'))return route.fulfill({headers:{...h,'content-range':'0-2/3'},body:JSON.stringify(single?rows[0]:rows)});
  if(p.startsWith('/functions'))return route.fulfill({headers:h,body:JSON.stringify({checks:[]})});
  return route.fulfill({headers:h,body:'{}'});});
}
