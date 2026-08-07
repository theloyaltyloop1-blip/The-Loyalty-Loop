import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
Deno.serve(async (req) => { if (req.method === 'OPTIONS') return new Response('ok',{headers:cors}); try {
  const auth=req.headers.get('Authorization'); if(!auth) throw new Error('Missing authorization');
  const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const token=auth.replace('Bearer ',''); const {data:{user},error}=await admin.auth.getUser(token); if(error||!user) throw new Error('Not authenticated');
  // auth.users deletion cascades profile, preferences, referral records and user-owned loyalty data.
  const {error:del}=await admin.auth.admin.deleteUser(user.id); if(del) throw del;
  return new Response(JSON.stringify({ok:true}),{headers:{...cors,'Content-Type':'application/json'}});
} catch(e) { return new Response(JSON.stringify({error:e instanceof Error?e.message:'Deletion failed'}),{status:400,headers:{...cors,'Content-Type':'application/json'}}) }});
