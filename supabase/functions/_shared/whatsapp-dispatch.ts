export async function sameSecret(expected: string | undefined, provided: string | null): Promise<boolean> {
  if (!expected || !provided) return false;
  const digest = (s: string) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  const [a,b] = await Promise.all([digest(`Bearer ${expected}`),digest(provided)]);
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let diff=0; for(let i=0;i<x.length;i++) diff|=x[i]^y[i]; return diff===0;
}
export type WhatsAppJob = {id:string;lease_id:string;phone_e164:string;user_id:string;event_type:string;parameters:string[]};
export async function sendWhatsAppTemplate(job: WhatsAppJob, fetchFn: typeof fetch, url: string, key: string) {
  const sizes: Record<string,number> = {spend_progress:4,reward_ready:2};
  if(!sizes[job.event_type] || job.parameters.length!==sizes[job.event_type]) return {outcome:'invalid_template',message:null};
  try {
    const r=await fetchFn(url,{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
      body:JSON.stringify({messaging_product:'whatsapp',to:job.phone_e164.replace(/^\+/,''),type:'template',
        template:{name:job.event_type,language:{code:'en_GB'},components:[{type:'body',parameters:job.parameters.map(text=>({type:'text',text:text.slice(0,1024)}))}]}}),signal:AbortSignal.timeout(15000)});
    if(!r.ok) return {outcome:r.status===429||r.status>=500?'retry':'rejected',message:null};
    const body=await r.json(); const id=body.messages?.[0]?.id;
    return {outcome:typeof id==='string'?'sent':'delivery_unknown',message:typeof id==='string'?id:null};
  } catch { return {outcome:'delivery_unknown',message:null}; }
}
