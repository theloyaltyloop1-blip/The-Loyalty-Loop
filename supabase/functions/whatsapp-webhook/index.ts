import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

type MetaMessage = { id?: string; from?: string; type?: string; text?: { body?: string } };
type MetaChange = { value?: { messages?: MetaMessage[] } };

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VERIFY_TOKEN = Deno.env.get("META_WHATSAPP_VERIFY_TOKEN");
const APP_SECRET = Deno.env.get("META_WHATSAPP_APP_SECRET");
const ACCESS_TOKEN = Deno.env.get("META_WHATSAPP_ACCESS_TOKEN");
const PHONE_NUMBER_ID = Deno.env.get("META_WHATSAPP_PHONE_NUMBER_ID");
const GRAPH_VERSION = Deno.env.get("META_WHATSAPP_GRAPH_VERSION") ?? "v22.0";
const APP_URL = (Deno.env.get("APP_BASE_URL") ?? "https://www.the-loyalty-loop.com").replace(/\/$/, "");

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function normalisePhone(input: string) {
  const digits = input.replace(/\D/g, "");
  return /^\d{7,15}$/.test(digits) ? `+${digits}` : null;
}

function safeName(input: string) {
  const name = input.replace(/[<>\n\r]/g, "").trim().replace(/\s+/g, " ");
  return name.length >= 1 && name.length <= 80 ? name : null;
}

function safeEmail(input: string) {
  const email = input.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254 ? email : null;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function secureEquals(expected: string, provided: string) {
  const a = new TextEncoder().encode(expected);
  const b = new TextEncoder().encode(provided);
  if (a.length !== b.length) return false;
  let different = 0;
  for (let i = 0; i < a.length; i += 1) different |= a[i] ^ b[i];
  return different === 0;
}

async function validSignature(rawBody: string, signature: string | null) {
  if (!APP_SECRET || !signature?.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(APP_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const digest = [...new Uint8Array(signed)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return secureEquals(digest, signature.slice("sha256=".length));
}

async function sendText(admin: ReturnType<typeof createClient>, phone: string, text: string, businessId?: string | null, userId?: string | null) {
  if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) throw new Error("WhatsApp sending is not configured");
  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: phone.replace(/^\+/, ""), type: "text", text: { preview_url: false, body: text.slice(0, 4096) } }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Meta send failed: ${response.status}`);
  await admin.from("whatsapp_message_log").insert({
    direction: "outbound", provider_message_id: result.messages?.[0]?.id ?? null, phone_e164: phone,
    user_id: userId ?? null, business_id: businessId ?? null, body: text, provider_payload: { message_id: result.messages?.[0]?.id ?? null },
  });
}

async function createLink(admin: ReturnType<typeof createClient>, values: {
  linkType: "signup" | "card"; phone: string; businessId?: string | null; userId?: string | null; email?: string | null; firstName?: string | null; hours: number;
}) {
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = btoa(String.fromCharCode(...tokenBytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  const { error } = await admin.from("whatsapp_handoff_links").insert({
    token_hash: await sha256(token), link_type: values.linkType, phone_e164: values.phone, business_id: values.businessId ?? null,
    user_id: values.userId ?? null, expected_email: values.email ?? null, first_name: values.firstName ?? null,
    expires_at: new Date(Date.now() + values.hours * 60 * 60 * 1000).toISOString(),
  });
  if (error) throw error;
  return token;
}

async function linkedCustomerReply(admin: ReturnType<typeof createClient>, phone: string, userId: string, businessId: string | null) {
  if (businessId) {
    await admin.from("memberships").upsert({ user_id: userId, business_id: businessId }, { onConflict: "user_id,business_id", ignoreDuplicates: true });
  }
  const [{ data: profile }, { data: memberships }] = await Promise.all([
    admin.from("profiles").select("first_name").eq("id", userId).single(),
    admin.from("memberships").select("stamp_count,points_balance,visit_count,business:businesses(name,loyalty_type)").eq("user_id", userId),
  ]);
  const token = await createLink(admin, { linkType: "card", phone, businessId, userId, hours: 168 });
  const total = memberships?.length ?? 0;
  await sendText(admin, phone,
    `Welcome back${profile?.first_name ? `, ${profile.first_name}` : ""}! You're collecting at ${total} ${total === 1 ? "shop" : "shops"}. Open your live Loyalty Loop card to show your QR code and see every balance: ${APP_URL}/whatsapp/card?token=${encodeURIComponent(token)}`,
    businessId, userId);
}

async function processText(admin: ReturnType<typeof createClient>, phone: string, message: string) {
  const text = message.trim();
  const command = text.toLowerCase();
  const { data: contact, error: contactError } = await admin
    .from("whatsapp_contacts")
    .upsert({ phone_e164: phone, last_inbound_at: new Date().toISOString() }, { onConflict: "phone_e164" })
    .select("user_id, opted_out_at")
    .single();
  if (contactError) throw contactError;

  if (command === "stop") {
    await admin.from("whatsapp_contacts").update({ opted_out_at: new Date().toISOString() }).eq("phone_e164", phone);
    await admin.from("whatsapp_conversations").upsert({ phone_e164: phone, state: "idle" });
    await sendText(admin, phone, "You will no longer receive Loyalty Loop WhatsApp updates. You can still see every reward in the app. Send START at any time to use WhatsApp again.");
    return;
  }

  const startMatch = /^start(?:\s+([a-z0-9][a-z0-9-]{0,100}))?$/i.exec(text);
  if (startMatch) {
    let businessId: string | null = null;
    if (startMatch[1]) {
      const { data: business } = await admin.from("businesses").select("id").eq("slug", startMatch[1].toLowerCase()).eq("is_active", true).maybeSingle();
      businessId = business?.id ?? null;
    }
    // START is an explicit request to resume the optional channel, including
    // for someone who previously used STOP.
    if (contact.user_id) {
      await admin.from("whatsapp_contacts").update({ opted_out_at: null, last_inbound_at: new Date().toISOString() }).eq("phone_e164", phone);
      await linkedCustomerReply(admin, phone, contact.user_id, businessId);
      return;
    }
    await admin.from("whatsapp_contacts").update({ opted_out_at: null, last_inbound_at: new Date().toISOString() }).eq("phone_e164", phone);
    await admin.from("whatsapp_conversations").upsert({ phone_e164: phone, state: "awaiting_name", business_id: businessId, pending_first_name: null, pending_email: null });
    await sendText(admin, phone, "Welcome to The Loyalty Loop. What's your first name?", businessId);
    return;
  }

  const { data: conversation } = await admin.from("whatsapp_conversations")
    .select("state,business_id,pending_first_name").eq("phone_e164", phone).maybeSingle();
  if (!conversation || conversation.state === "idle") {
    await sendText(admin, phone, "Send START after scanning a shop's Loyalty Loop QR code and I'll help you get set up.");
    return;
  }
  if (conversation.state === "awaiting_name") {
    const firstName = safeName(text);
    if (!firstName) {
      await sendText(admin, phone, "Please send just your first name (up to 80 characters).");
      return;
    }
    await admin.from("whatsapp_conversations").update({ state: "awaiting_email", pending_first_name: firstName }).eq("phone_e164", phone);
    await sendText(admin, phone, `Thanks, ${firstName}. What email address should we use for your Loyalty Loop account?`, conversation.business_id);
    return;
  }
  if (conversation.state === "awaiting_email") {
    const email = safeEmail(text);
    if (!email) {
      await sendText(admin, phone, "That doesn't look like an email address. Please try again.", conversation.business_id);
      return;
    }
    const token = await createLink(admin, {
      linkType: "signup", phone, businessId: conversation.business_id, email,
      firstName: conversation.pending_first_name, hours: 2,
    });
    await admin.from("whatsapp_conversations").update({ state: "handoff_sent", pending_email: email }).eq("phone_e164", phone);
    await sendText(admin, phone,
      `Almost there. Use this secure Loyalty Loop page to choose your password (or sign in if you already have an account): ${APP_URL}/whatsapp/onboarding?token=${encodeURIComponent(token)}\n\nFor your security, never send a password in WhatsApp.`,
      conversation.business_id);
    return;
  }
  await sendText(admin, phone, "Your secure account link is still active. Open the most recent Loyalty Loop link, or send START to begin again.", conversation.business_id);
}

Deno.serve(async (request: Request) => {
  if (request.method === "GET") {
    const url = new URL(request.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    return mode === "subscribe" && token && VERIFY_TOKEN && await secureEquals(VERIFY_TOKEN, token) && challenge
      ? new Response(challenge, { status: 200 })
      : new Response("forbidden", { status: 403 });
  }
  if (request.method !== "POST") return new Response("method not allowed", { status: 405 });

  const raw = await request.text();
  if (!await validSignature(raw, request.headers.get("x-hub-signature-256"))) return new Response("invalid signature", { status: 401 });
  try {
    const payload = JSON.parse(raw) as { entry?: Array<{ changes?: MetaChange[] }> };
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const messages = payload.entry?.flatMap((entry) => entry.changes?.flatMap((change) => change.value?.messages ?? []) ?? []) ?? [];
    for (const item of messages) {
      const phone = item.from ? normalisePhone(item.from) : null;
      const text = item.type === "text" ? item.text?.body : null;
      if (!phone || !text || !item.id) continue;
      // The log has a foreign key to the contact. Create the contact before
      // recording the provider message, while still leaving the command
      // processor responsible for opt-in and conversation state.
      const { error: contactError } = await admin.from("whatsapp_contacts")
        .upsert({ phone_e164: phone, last_inbound_at: new Date().toISOString() }, { onConflict: "phone_e164" });
      if (contactError) throw contactError;
      // Email addresses are needed briefly for the handoff but do not need to
      // be copied into the long-lived chat log.
      const logBody = safeEmail(text) ? "[email supplied]" : text.slice(0, 1024);
      const { error } = await admin.from("whatsapp_message_log").insert({
        direction: "inbound", provider_message_id: item.id, phone_e164: phone, message_kind: "text", body: logBody, provider_payload: { type: item.type },
      });
      if (error?.code === "23505") continue;
      if (error) throw error;
      await processText(admin, phone, text);
    }
    return json({ ok: true });
  } catch (error) {
    console.error("whatsapp-webhook", error);
    return json({ ok: false }, 500);
  }
});
