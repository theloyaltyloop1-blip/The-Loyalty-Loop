import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
Deno.serve(async (req) => { if (req.method === 'OPTIONS') return new Response('ok',{headers:cors}); try {
  const auth=req.headers.get('Authorization'); if(!auth) throw new Error('Missing authorization');
  const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const token=auth.replace('Bearer ',''); const {data:{user},error}=await admin.auth.getUser(token); if(error||!user) throw new Error('Not authenticated');
  const { data: ownedBusinesses, error: ownershipError } = await admin.from('businesses').select('id').eq('owner_id', user.id);
  if (ownershipError) throw ownershipError;
  if (ownedBusinesses?.length) throw new Error('Transfer or permanently delete every shop before deleting this account.');

  // Storage refuses Auth deletion while an account owns a file. Remove these
  // with the Storage API (not SQL) so the actual object is removed too.
  const { data: storageFiles, error: storageLookupError } = await admin.schema('storage').from('objects').select('bucket_id,name').eq('owner', user.id);
  if (storageLookupError) throw storageLookupError;
  const filesByBucket = new Map<string, string[]>();
  for (const file of storageFiles ?? []) filesByBucket.set(file.bucket_id, [...(filesByBucket.get(file.bucket_id) ?? []), file.name]);
  for (const [bucket, paths] of filesByBucket) {
    const { error: storageDeleteError } = await admin.storage.from(bucket).remove(paths);
    if (storageDeleteError) throw storageDeleteError;
  }

  // Remove the customer’s personal records in dependency order. Analytics is
  // calculated from shop data; their individually identifiable activity is not retained.
  // Deleting a WhatsApp contact cascades its short-lived handoff links,
  // conversation state and metadata-only message log. It must happen before
  // Auth deletion, otherwise the contact would be detached but retained.
  for (const table of ['whatsapp_contacts', 'notifications', 'transactions', 'rewards', 'memberships', 'winback_email_log', 'reviews', 'platform_audit_log']) {
    const { error: deleteError } = await admin.from(table).delete().eq(table === 'platform_audit_log' ? 'actor_id' : 'user_id', user.id);
    if (deleteError) throw deleteError;
  }
  for (const operation of [
    admin.from('profiles').update({ referred_by: null }).eq('referred_by', user.id),
    admin.from('staff_members').update({ user_id: null }).eq('user_id', user.id),
    admin.from('platform_announcements').update({ created_by: null }).eq('created_by', user.id),
    admin.from('support_requests').update({ resolved_by: null }).eq('resolved_by', user.id),
    admin.from('brand_handoffs').delete().or(`from_owner_id.eq.${user.id},to_owner_id.eq.${user.id}`),
    admin.from('brand_members').delete().eq('user_id', user.id),
  ]) {
    const { error: cleanupError } = await operation;
    if (cleanupError) throw cleanupError;
  }

  // Auth deletion cascades the remaining account-owned records (profile,
  // settings, roles, tokens, referrals, legal acceptance and sessions).
  const {error:del}=await admin.auth.admin.deleteUser(user.id); if(del) throw del;
  return new Response(JSON.stringify({ok:true}),{headers:{...cors,'Content-Type':'application/json'}});
} catch(e) { return new Response(JSON.stringify({error:e instanceof Error?e.message:'Deletion failed'}),{status:400,headers:{...cors,'Content-Type':'application/json'}}) }});
