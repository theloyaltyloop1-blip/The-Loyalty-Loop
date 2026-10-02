import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {createClient} from 'jsr:@supabase/supabase-js@2';
import {sameSecret,sendWhatsAppTemplate,type WhatsAppJob} from '../_shared/whatsapp-dispatch.ts';
Deno.serve(async req=>{
  if(req.method!=='POST') return new Response('method not allowed',{status:405});
  if(!await sameSecret(Deno.env.get('WHATSAPP_DISPATCH_SECRET'),req.headers.get('authorization'))) return new Response('unauthorized',{status:401});
  const key=Deno.env.get('META_WHATSAPP_ACCESS_TOKEN'),phone=Deno.env.get('META_WHATSAPP_PHONE_NUMBER_ID');
  if(!key||!phone) return Response.json({error:'not configured'},{status:503});
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  let sent=0;
  try {
    for(let i=0;i<50;i++) {
      const {data,error}=await db.rpc('claim_whatsapp_outbox'); if(error) throw Error('claim failed'); if(!data) break;
      const job=data as WhatsAppJob;
      // Recheck immediately before sending; cancelled contacts are never used from a stale claim.
      const {data:c,error:ce}=await db.from('whatsapp_contacts').select('user_id,opted_out_at,logged_out_at').eq('phone_e164',job.phone_e164).maybeSingle();
      const result=ce||!c||c.user_id!==job.user_id||c.opted_out_at||c.logged_out_at?{outcome:'suppressed',message:null}:
        await sendWhatsAppTemplate(job,fetch,`https://graph.facebook.com/${Deno.env.get('META_WHATSAPP_GRAPH_VERSION')??'v25.0'}/${phone}/messages`,key);
      const {error:fe}=await db.rpc('finish_whatsapp_outbox',{p_id:job.id,p_lease:job.lease_id,p_outcome:result.outcome,p_message:result.message});
      if(fe) throw Error('finish failed'); if(result.outcome==='sent') sent++;
    }
    return Response.json({sent});
  } catch {return Response.json({error:'dispatch failed'},{status:500});}
});
