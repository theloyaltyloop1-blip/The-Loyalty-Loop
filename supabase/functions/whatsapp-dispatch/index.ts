import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DISPATCH_SECRET = Deno.env.get("WHATSAPP_DISPATCH_SECRET");
const ACCESS_TOKEN = Deno.env.get("META_WHATSAPP_ACCESS_TOKEN");
const PHONE_NUMBER_ID = Deno.env.get("META_WHATSAPP_PHONE_NUMBER_ID");
const GRAPH_VERSION = Deno.env.get("META_WHATSAPP_GRAPH_VERSION") ?? "v22.0";
const TEMPLATE_NAME = Deno.env.get("META_WHATSAPP_TRANSACTION_TEMPLATE_NAME");
const TEMPLATE_LANGUAGE = Deno.env.get("META_WHATSAPP_TEMPLATE_LANGUAGE") ?? "en_GB";

function sameSecret(provided: string | null) {
  return Boolean(DISPATCH_SECRET && provided === `Bearer ${DISPATCH_SECRET}`);
}

async function sendText(phone: string, body: string) {
  return fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: phone.replace(/^\+/, ""), type: "text", text: { preview_url: false, body } }),
  });
}

async function sendTemplate(phone: string, body: string) {
  return fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp", to: phone.replace(/^\+/, ""), type: "template",
      template: { name: TEMPLATE_NAME, language: { code: TEMPLATE_LANGUAGE }, components: [{ type: "body", parameters: [{ type: "text", text: body.slice(0, 1024) }] }] },
    }),
  });
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return new Response("method not allowed", { status: 405 });
  if (!sameSecret(request.headers.get("authorization"))) return new Response("unauthorized", { status: 401 });
  if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) return Response.json({ error: "WhatsApp sending is not configured" }, { status: 503 });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: pending, error } = await admin.from("whatsapp_outbox")
    .select("id,user_id,phone_e164,business_id,event_type,body,created_at")
    .eq("status", "pending").order("created_at").limit(50);
  if (error) return Response.json({ error: "Could not load message queue" }, { status: 500 });

  let sent = 0;
  for (const item of pending ?? []) {
    const { data: contact } = await admin.from("whatsapp_contacts").select("opted_out_at,last_inbound_at").eq("phone_e164", item.phone_e164).maybeSingle();
    if (contact?.opted_out_at) {
      await admin.from("whatsapp_outbox").update({ status: "suppressed", error_message: "customer opted out" }).eq("id", item.id);
      continue;
    }
    const withinCustomerServiceWindow = contact?.last_inbound_at && new Date(contact.last_inbound_at).getTime() > Date.now() - 24 * 60 * 60 * 1000;
    if (!withinCustomerServiceWindow && !TEMPLATE_NAME) {
      await admin.from("whatsapp_outbox").update({ status: "failed", error_message: "A Meta-approved transaction template is required outside the 24-hour customer-service window." }).eq("id", item.id);
      continue;
    }
    try {
      const response = withinCustomerServiceWindow ? await sendText(item.phone_e164, item.body) : await sendTemplate(item.phone_e164, item.body);
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(`Meta rejected the message (${response.status})`);
      await Promise.all([
        admin.from("whatsapp_outbox").update({ status: "sent", sent_at: new Date().toISOString(), provider_message_id: result.messages?.[0]?.id ?? null, error_message: null }).eq("id", item.id),
        admin.from("whatsapp_message_log").insert({ direction: "outbound", provider_message_id: result.messages?.[0]?.id ?? null, phone_e164: item.phone_e164, user_id: item.user_id, business_id: item.business_id, message_kind: item.event_type, body: item.body, provider_payload: { outbox_id: item.id } }),
      ]);
      sent += 1;
    } catch (dispatchError) {
      await admin.from("whatsapp_outbox").update({ status: "failed", error_message: dispatchError instanceof Error ? dispatchError.message : "Unknown delivery failure" }).eq("id", item.id);
    }
  }
  return Response.json({ processed: pending?.length ?? 0, sent });
});
