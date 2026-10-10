import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { isLogout, isStop, LOGGED_OUT_ALREADY, LOGOUT_REPLY, progressLine, stampProgressText, STOP_REPLY, welcomeBack, type ShopProgress } from "../_shared/whatsapp-messages.ts";
import { answerQuestion, DAILY_QUESTION_LIMIT, LIMIT_REPLY, type BotShop, type ChatMessage } from "../_shared/whatsapp-bot.ts";
import {
  ASK_LOCATION, joinChoices, matchShops, NO_SHOP_FOUND, nearbyReply, nearestShops, parseJoin, parseNearby, type Shop,
} from "../_shared/whatsapp-shops.ts";

type MetaMessage = { id?: string; from?: string; type?: string; text?: { body?: string }; location?: { latitude?: number; longitude?: number } };
type MetaChange = { value?: { messages?: MetaMessage[] } };

// Untyped client: this project has no generated database types.
// deno-lint-ignore no-explicit-any
type Admin = SupabaseClient<any, "public", any>;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VERIFY_TOKEN = Deno.env.get("META_WHATSAPP_VERIFY_TOKEN");
const APP_SECRET = Deno.env.get("META_WHATSAPP_APP_SECRET");
const ACCESS_TOKEN = Deno.env.get("META_WHATSAPP_ACCESS_TOKEN");
const PHONE_NUMBER_ID = Deno.env.get("META_WHATSAPP_PHONE_NUMBER_ID");
const GRAPH_VERSION = Deno.env.get("META_WHATSAPP_GRAPH_VERSION") ?? "v25.0";
const APP_URL = (Deno.env.get("APP_BASE_URL") ?? "https://www.the-loyalty-loop.com").replace(/\/$/, "");
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");

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
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(APP_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const digest = [...new Uint8Array(signed)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return secureEquals(digest, signature.slice("sha256=".length));
}

async function sendText(admin: Admin, phone: string, text: string, kind: string, businessId?: string | null, userId?: string | null) {
  if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) throw new Error("WhatsApp sending is not configured");
  if(kind !== 'stop') {
    const {data:contact,error}=await admin.from('whatsapp_contacts').select('user_id,opted_out_at').eq('phone_e164',phone).maybeSingle();
    if(error||!contact||contact.opted_out_at||(userId&&kind!=='logout'&&contact.user_id!==userId)) throw Error('WhatsApp contact is not active');
  }
  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: phone.replace(/^\+/, ""), type: "text", text: { preview_url: false, body: text.slice(0, 4096) } }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Meta send failed: ${response.status}`);
  await admin.from("whatsapp_message_log").insert({
    direction: "outbound", provider_message_id: result.messages?.[0]?.id ?? null, phone_e164: phone,
    user_id: userId ?? null, business_id: businessId ?? null, message_kind: kind,
    provider_payload: { message_id: result.messages?.[0]?.id ?? null },
  });
}

async function createLink(admin: Admin, values: {
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

async function linkedCustomerReply(admin: Admin, phone: string, userId: string, businessId: string | null) {
  if (businessId) {
    await admin.from("memberships").upsert({ user_id: userId, business_id: businessId }, { onConflict: "user_id,business_id", ignoreDuplicates: true });
  }
  const [{ data: profile }, { data: memberships }] = await Promise.all([
    admin.from("profiles").select("first_name").eq("id", userId).single(),
    admin.from("memberships")
      .select("reward_progress_pence,stamp_count,points_balance,visit_count,business:businesses(id,name,reward_model,loyalty_type,loyalty_config,reward_threshold_pence,reward_catalog(title,spend_threshold_pence))")
      .eq("user_id", userId)
      .order("last_activity_at", { ascending: false, nullsFirst: false }),
  ]);
  const shops: ShopProgress[] = (memberships ?? []).flatMap((m) => {
    const business = Array.isArray(m.business) ? m.business[0] : m.business;
    return business ? [{
      name: business.name,
      progressPence: m.reward_progress_pence ?? 0,
      thresholdPence: business.reward_threshold_pence ?? null,
      tiers: business.reward_catalog ?? [],
      stampLine: stampProgressText(business, m),
    }] : [];
  });
  const token = await createLink(admin, { linkType: "card", phone, businessId, userId, hours: 1 });
  await sendText(admin, phone,
    welcomeBack(profile?.first_name ?? null, shops, `${APP_URL}/whatsapp/card?token=${encodeURIComponent(token)}`),
    "start_existing_customer", businessId, userId);
}

async function ensureContact(admin: Admin, phone: string) {
  const { error } = await admin.from("whatsapp_contacts")
    .upsert({ phone_e164: phone, last_inbound_at: new Date().toISOString() }, { onConflict: "phone_e164" });
  if (error) throw error;
}

async function activeConversation(admin: Admin, phone: string) {
  const { data } = await admin.from("whatsapp_conversations").select("state").eq("phone_e164", phone).maybeSingle();
  return data?.state && data.state !== "idle" ? data.state : null;
}

async function groqChat(messages: ChatMessage[], maxTokens: number): Promise<string> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "openai/gpt-oss-120b", messages, temperature: 0.3, max_tokens: maxTokens, reasoning_effort: "low" }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`groq_${response.status}`);
  const body = await response.json();
  return body.choices?.[0]?.message?.content ?? "";
}

async function recentCount(admin: Admin, phone: string, direction: "inbound" | "outbound", kinds: string[], hours: number) {
  const { count } = await admin.from("whatsapp_message_log")
    .select("id", { count: "exact", head: true })
    .eq("phone_e164", phone).eq("direction", direction).in("message_kind", kinds)
    .gte("created_at", new Date(Date.now() - hours * 60 * 60 * 1000).toISOString());
  return count ?? 0;
}

// Free text outside a sign-up chat. Linked, opted-in customers get an AI
// answer about their own cards; anyone else gets a START nudge at most once
// a day. Opted-out numbers are never messaged.
async function askBot(admin: Admin, phone: string, text: string): Promise<string | null> {
  const { data: contact } = await admin.from("whatsapp_contacts")
    .select("user_id, opted_out_at").eq("phone_e164", phone).maybeSingle();
  if (contact?.opted_out_at) return null;
  if (!contact?.user_id) {
    if (await recentCount(admin, phone, "outbound", ["start_prompt"], 24)) return null;
    await ensureContact(admin, phone);
    await sendText(admin, phone, "Hi! Send START to get your Loyalty Loop card and see your rewards here.", "start_prompt");
    return "question";
  }
  const userId = contact.user_id;
  await admin.from("whatsapp_contacts").update({ last_inbound_at: new Date().toISOString() }).eq("phone_e164", phone);
  if (await recentCount(admin, phone, "inbound", ["question"], 24) > DAILY_QUESTION_LIMIT) {
    if (!await recentCount(admin, phone, "outbound", ["bot_limit"], 24)) await sendText(admin, phone, LIMIT_REPLY, "bot_limit", null, userId);
    return "question";
  }

  const [{ data: profile }, { data: memberships }, { data: rewards }] = await Promise.all([
    admin.from("profiles").select("first_name").eq("id", userId).single(),
    admin.from("memberships")
      .select("reward_progress_pence,stamp_count,points_balance,visit_count,business:businesses(id,name,category,description,reward_model,loyalty_type,loyalty_config,reward_threshold_pence,reward_catalog(title,spend_threshold_pence))")
      .eq("user_id", userId),
    admin.from("rewards").select("business_id,title,expires_at").eq("user_id", userId).is("redeemed_at", null),
  ]);
  const now = Date.now();
  const shops: BotShop[] = (memberships ?? []).flatMap((m) => {
    const business = Array.isArray(m.business) ? m.business[0] : m.business;
    if (!business) return [];
    return [{
      name: business.name,
      category: business.category ?? null,
      description: business.description ?? null,
      progressPence: m.reward_progress_pence ?? 0,
      thresholdPence: business.reward_threshold_pence ?? null,
      tiers: business.reward_catalog ?? [],
      stampLine: stampProgressText(business, m),
      readyRewards: (rewards ?? [])
        .filter((r) => r.business_id === business.id && (!r.expires_at || Date.parse(r.expires_at) > now))
        .map((r) => r.title),
    }];
  });
  const token = await createLink(admin, { linkType: "card", phone, userId, hours: 1 });
  const cardUrl = `${APP_URL}/whatsapp/card?token=${encodeURIComponent(token)}`;
  const chat = GROQ_API_KEY ? groqChat : async () => { throw new Error("not_configured"); };
  const answer = await answerQuestion({ firstName: profile?.first_name ?? null, shops }, text, chat, cardUrl);
  await sendText(admin, phone, answer.text, answer.kind, null, userId);
  return "question";
}

async function approvedShops(admin: Admin): Promise<Shop[]> {
  const { data } = await admin.from("businesses")
    .select("id,name,slug,category,lat,lng")
    .eq("is_active", true).eq("approval_status", "approved").eq("whatsapp_onboarding_enabled", true)
    .limit(2000);
  return (data ?? []) as Shop[];
}

async function linkedUser(admin: Admin, phone: string): Promise<{ userId: string | null; optedOut: boolean }> {
  const { data } = await admin.from("whatsapp_contacts").select("user_id, opted_out_at").eq("phone_e164", phone).maybeSingle();
  return { userId: data?.user_id ?? null, optedOut: Boolean(data?.opted_out_at) };
}

// "JOIN <shop>". A linked customer joins straight away; anyone else starts
// sign-up with that shop, exactly like scanning its QR code.
async function joinByChat(admin: Admin, phone: string, query: string): Promise<string | null> {
  const { userId, optedOut } = await linkedUser(admin, phone);
  if (optedOut) return null;
  if (await recentCount(admin, phone, "outbound", ["join"], 0.5)) return null;
  const matches = matchShops(query, await approvedShops(admin));
  if (!matches.length) {
    await sendText(admin, phone, NO_SHOP_FOUND, "join", null, userId);
    return "join";
  }
  if (matches.length > 1) {
    await sendText(admin, phone, joinChoices(matches), "join", null, userId);
    return "join";
  }
  const shop = matches[0];
  if (!userId) return await processText(admin, phone, `START ${shop.slug}`);

  const { data: existing } = await admin.from("memberships").select("id").eq("user_id", userId).eq("business_id", shop.id).maybeSingle();
  if (!existing) {
    const { error } = await admin.from("memberships").insert({ user_id: userId, business_id: shop.id });
    if (error && error.code !== "23505") throw error;
  }
  const [{ data: membership }, { data: business }] = await Promise.all([
    admin.from("memberships").select("reward_progress_pence,stamp_count,points_balance,visit_count").eq("user_id", userId).eq("business_id", shop.id).single(),
    admin.from("businesses").select("reward_model,loyalty_type,loyalty_config,reward_threshold_pence,reward_catalog(title,spend_threshold_pence)").eq("id", shop.id).single(),
  ]);
  const token = await createLink(admin, { linkType: "card", phone, userId, businessId: shop.id, hours: 1 });
  const line = progressLine({
    name: shop.name,
    progressPence: membership?.reward_progress_pence ?? 0,
    thresholdPence: business?.reward_threshold_pence ?? null,
    tiers: business?.reward_catalog ?? [],
    stampLine: business && membership ? stampProgressText(business, membership) : null,
  }).replace(/^• /, "");
  await sendText(admin, phone,
    `${existing ? "You're already a member of" : "You've joined"} ${shop.name}! 🎉\n\n${line}\n\nShow your card at the till to earn: ${APP_URL}/whatsapp/card?token=${encodeURIComponent(token)}`,
    "join", shop.id, userId);
  return "join";
}

async function replyNearby(admin: Admin, phone: string, lat: number, lng: number): Promise<string | null> {
  const { userId, optedOut } = await linkedUser(admin, phone);
  if (optedOut) return null;
  const found = nearestShops(lat, lng, await approvedShops(admin));
  let joined = new Set<string>();
  if (userId && found.length) {
    const { data } = await admin.from("memberships").select("business_id").eq("user_id", userId).in("business_id", found.map((f) => f.shop.id));
    joined = new Set((data ?? []).map((m) => m.business_id));
  }
  await ensureContact(admin, phone);
  await sendText(admin, phone, nearbyReply(found, joined), "nearby", null, userId);
  return "nearby";
}

// "shops near <postcode>": look the postcode up (postcodes.io, UK only).
async function shopsNear(admin: Admin, phone: string, postcode: string): Promise<string | null> {
  try {
    const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`, { signal: AbortSignal.timeout(8_000) });
    const body = await response.json().catch(() => null);
    const lat = body?.result?.latitude, lng = body?.result?.longitude;
    if (response.ok && typeof lat === "number" && typeof lng === "number") return await replyNearby(admin, phone, lat, lng);
  } catch {
    // Fall through to the not-found reply.
  }
  const { userId, optedOut } = await linkedUser(admin, phone);
  if (optedOut) return null;
  await sendText(admin, phone, `I couldn't find the postcode ${postcode}. Try another, or share your location instead.`, "nearby", null, userId);
  return "nearby";
}

// Returns the kind of inbound message handled, or null if it was ignored.
async function processText(admin: Admin, phone: string, message: string): Promise<string | null> {
  const text = message.trim();
  // STOP must always work, even when no sign-up conversation is open.
  if (isStop(text)) {
    await ensureContact(admin, phone);
    // Opt-out and pending suppression already committed atomically with reservation.
    const {error:contactError}=await admin.from("whatsapp_contacts").update({ opted_out_at: new Date().toISOString() }).eq("phone_e164", phone);
    if(contactError)throw Error('STOP contact update failed');
    const {error:conversationError}=await admin.from("whatsapp_conversations").upsert({ phone_e164: phone, state: "idle", pending_first_name: null, pending_email: null });
    if(conversationError)throw Error('STOP conversation update failed');
    await sendText(admin, phone, STOP_REPLY, "stop");
    return "stop";
  }
  // LOGOUT unlinks this number from the account and cancels card links
  // already sent here. The account itself is untouched.
  if (isLogout(text)) {
    const { data: linked } = await admin.from("whatsapp_contacts").select("user_id, opted_out_at").eq("phone_e164", phone).maybeSingle();
    if (linked?.opted_out_at) return null;
    if (!linked?.user_id) {
      await sendText(admin, phone, LOGGED_OUT_ALREADY, "logout");
      return "logout";
    }
    const now = new Date().toISOString();
    await admin.from("whatsapp_contacts").update({ user_id: null, logged_out_at: now }).eq("phone_e164", phone);
    await admin.from("whatsapp_handoff_links").update({ expires_at: now })
      .eq("phone_e164", phone).is("claimed_at", null).gt("expires_at", now);
    await admin.from("whatsapp_conversations").upsert({ phone_e164: phone, state: "idle", pending_first_name: null, pending_email: null });
    await sendText(admin, phone, LOGOUT_REPLY, "logout", null, linked.user_id);
    return "logout";
  }
  const startMatch = /^start(?:\s+([a-z0-9][a-z0-9-]{0,100}))?$/i.exec(text);
  const conversationState = startMatch ? null : await activeConversation(admin, phone);
  if (!startMatch && !conversationState) {
    const joinQuery = parseJoin(text);
    if (joinQuery) return await joinByChat(admin, phone, joinQuery);
    const nearby = parseNearby(text);
    if (nearby === "ask") {
      await sendText(admin, phone, ASK_LOCATION, "nearby_ask");
      return "nearby";
    }
    if (nearby) return await shopsNear(admin, phone, nearby.postcode);
    return await askBot(admin, phone, text);
  }

  await ensureContact(admin, phone);
  const { data: contact, error: contactError } = await admin.from("whatsapp_contacts")
    .select("user_id, opted_out_at").eq("phone_e164", phone).single();
  if (contactError) throw contactError;

  if (startMatch) {
    let businessId: string | null = null;
    if (startMatch[1]) {
      const { data: business } = await admin.from("businesses").select("id").eq("slug", startMatch[1].toLowerCase()).eq("is_active", true).eq("approval_status", "approved").eq("whatsapp_onboarding_enabled", true).maybeSingle();
      businessId = business?.id ?? null;
    }
    let linkedUserId = contact.user_id;
    // After someone has logged out here, never re-link by phone number alone
    // (the phone may have changed hands): they confirm their email instead.
    const { data: logoutContact } = await admin.from("whatsapp_contacts").select("logged_out_at").eq("phone_e164", phone).single();
    const loggedOutBefore = !linkedUserId && Boolean(logoutContact?.logged_out_at);
    if (!linkedUserId && !loggedOutBefore) {
      const { data: foundUserId } = await admin.rpc("find_whatsapp_user_by_phone", { _phone: phone });
      linkedUserId = foundUserId ?? null;
      if (linkedUserId) await admin.from("whatsapp_contacts").update({ user_id: linkedUserId, opted_out_at: null }).eq("phone_e164", phone);
    }
    if (linkedUserId) {
      await admin.from("whatsapp_contacts").update({ opted_out_at: null, logged_out_at: null, last_inbound_at: new Date().toISOString() }).eq("phone_e164", phone);
      await linkedCustomerReply(admin, phone, linkedUserId, businessId);
      return "start";
    }
    await admin.from("whatsapp_contacts").update({ opted_out_at: null, last_inbound_at: new Date().toISOString() }).eq("phone_e164", phone);
    await admin.from("whatsapp_conversations").upsert({ phone_e164: phone, state: "awaiting_name", business_id: businessId, pending_first_name: null, pending_email: null });
    await sendText(admin, phone, "Welcome to The Loyalty Loop. What's your first name?", "start_new_customer", businessId);
    return "start";
  }

  const { data: conversation } = await admin.from("whatsapp_conversations").select("state,business_id,pending_first_name").eq("phone_e164", phone).maybeSingle();
  if (!conversation || conversation.state === "idle") return null;
  if (conversation.state === "awaiting_name") {
    const firstName = safeName(text);
    if (!firstName) {
      await sendText(admin, phone, "Please send just your first name (up to 80 characters).", "invalid_name", conversation.business_id);
      return "conversation_step";
    }
    await admin.from("whatsapp_conversations").update({ state: "awaiting_email", pending_first_name: firstName }).eq("phone_e164", phone);
    await sendText(admin, phone, `Thanks, ${firstName}. What email address should we use for your Loyalty Loop account?`, "request_email", conversation.business_id);
    return "conversation_step";
  }
  if (conversation.state === "awaiting_email") {
    const email = safeEmail(text);
    if (!email) {
      await sendText(admin, phone, "That doesn't look like an email address. Please try again.", "invalid_email", conversation.business_id);
      return "conversation_step";
    }
    const token = await createLink(admin, { linkType: "signup", phone, businessId: conversation.business_id, email, firstName: conversation.pending_first_name, hours: 2 });
    await admin.from("whatsapp_conversations").update({ state: "handoff_sent", pending_email: email }).eq("phone_e164", phone);
    await sendText(admin, phone,
      `Almost there. Use this secure Loyalty Loop page to choose your password (or sign in if you already have an account): ${APP_URL}/whatsapp/onboarding?token=${encodeURIComponent(token)}\n\nFor your security, never send a password in WhatsApp.`,
      "secure_handoff", conversation.business_id);
    return "conversation_step";
  }
  await sendText(admin, phone, "Your secure account link is still active. Open the most recent Loyalty Loop link, or send START to begin again.", "handoff_reminder", conversation.business_id);
  return "conversation_step";
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
      // A shared location finds nearby shops. It is used once and not stored.
      const lat = item.type === "location" ? item.location?.latitude : undefined;
      const lng = item.type === "location" ? item.location?.longitude : undefined;
      const location = typeof lat === "number" && typeof lng === "number" ? { lat, lng } : null;
      if (!phone || (!text && !location) || !item.id) continue;
      const commandKind = text && isStop(text) ? 'stop' : text && isLogout(text) ? 'logout' : text && /^start(?:\s+([a-z0-9][a-z0-9-]{0,100}))?$/i.test(text.trim()) ? 'start' : 'question';
      const { data: reserved, error: reserveError } = await admin.rpc('reserve_whatsapp_inbound', {p_id:item.id,p_phone:phone,p_kind:commandKind});
      if(reserveError) throw Error('inbound reservation failed');
      if(!reserved) continue;
      try {
      const kind = location
        ? await replyNearby(admin, phone, location.lat, location.lng)
        : await processText(admin, phone, text!);
      if (!kind) continue;
      await admin.from("whatsapp_message_log").update({message_kind:kind,provider_payload:{type:item.type}}).eq('provider_message_id',item.id);
      } catch { console.error('whatsapp-webhook reserved command failed'); }
    }
    return json({ ok: true });
  } catch (error) {
    console.error("whatsapp-webhook request failed");
    return json({ ok: false }, 500);
  }
});
