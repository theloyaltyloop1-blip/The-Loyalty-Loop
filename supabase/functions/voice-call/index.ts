import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Owner-only phone line: call the Twilio number, enter the PIN, describe a
// feature. The transcript lands in voice_requests for a Claude session to pick
// up. Phone requests only ever become branches/PRs, never deploys.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_FROM_NUMBER = Deno.env.get("TWILIO_FROM_NUMBER");
const OWNER_PHONE = Deno.env.get("VOICE_OWNER_PHONE"); // E.164, e.g. +447...
const VOICE_PIN = Deno.env.get("VOICE_PIN");
// Secret for the "call me" link (?step=callme&key=...): Twilio rings the owner instead of the owner dialling in.
const VOICE_TRIGGER_KEY = Deno.env.get("VOICE_TRIGGER_KEY");
const DAILY_LIMIT = 5;

// Twilio signs the public URL, not the internal one the runtime sees.
const PUBLIC_BASE = `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/voice-call`;

function twiml(body: string) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    headers: { "Content-Type": "text/xml" },
  });
}

const hangUp = (message: string) => twiml(`<Say>${message}</Say><Hangup/>`);

function secureEquals(expected: string, provided: string) {
  const a = new TextEncoder().encode(expected);
  const b = new TextEncoder().encode(provided);
  if (a.length !== b.length) return false;
  let different = 0;
  for (let i = 0; i < a.length; i += 1) different |= a[i] ^ b[i];
  return different === 0;
}

async function validTwilioSignature(url: string, params: URLSearchParams, signature: string | null) {
  if (!TWILIO_AUTH_TOKEN || !signature) return false;
  const data = url + [...params.keys()].sort().map((key) => key + params.get(key)).join("");
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(TWILIO_AUTH_TOKEN), { name: "HMAC", hash: "SHA-1" }, false, ["sign"],
  );
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)));
  return secureEquals(btoa(String.fromCharCode(...mac)), signature);
}

async function sendSms(to: string, body: string) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) return;
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: TWILIO_FROM_NUMBER, Body: body }),
  });
}

function page(message: string, status = 200) {
  return new Response(
    `<!doctype html><meta name="viewport" content="width=device-width"><title>Loyalty Loop line</title>` +
      `<body style="font:20px system-ui;padding:32px;text-align:center">${message}</body>`,
    { status, headers: { "Content-Type": "text/html" } },
  );
}

async function callOwner() {
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: OWNER_PHONE!, From: TWILIO_FROM_NUMBER!, Url: PUBLIC_BASE, Method: "POST" }),
  });
  return res.ok;
}

Deno.serve(async (req) => {
  if (!OWNER_PHONE || !VOICE_PIN || !TWILIO_AUTH_TOKEN) return new Response("Not configured", { status: 503 });

  const query = new URL(req.url).searchParams;
  const step = query.get("step") ?? "start";

  // "Call me" link: the key is the only check, and it can only ever ring the owner's phone.
  if (step === "callme") {
    if (!VOICE_TRIGGER_KEY || !TWILIO_ACCOUNT_SID || !TWILIO_FROM_NUMBER) return page("Not configured.", 503);
    if (!secureEquals(VOICE_TRIGGER_KEY, query.get("key") ?? "")) return page("Not found.", 404);
    return (await callOwner()) ? page("Calling you now 📞") : page("Couldn't start the call.", 502);
  }

  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const publicUrl = step === "start" ? PUBLIC_BASE : `${PUBLIC_BASE}?step=${step}`;
  const params = new URLSearchParams(await req.text());
  if (!(await validTwilioSignature(publicUrl, params, req.headers.get("X-Twilio-Signature")))) {
    return new Response("Forbidden", { status: 403 });
  }

  // Caller ID can be spoofed, so it is only a first filter; the PIN is the real check.
  // The owner is "From" when dialling in and "To" on call-me calls. Transcription
  // callbacks don't reliably carry Direction, so accept either side; the signature
  // already proves the request came from Twilio on this account.
  if (params.get("From") !== OWNER_PHONE && params.get("To") !== OWNER_PHONE) return hangUp("This number is not available.");

  if (step === "start") {
    return twiml(
      `<Gather input="dtmf" numDigits="${VOICE_PIN.length}" timeout="10" action="${PUBLIC_BASE}?step=pin">` +
        `<Say>Enter your PIN.</Say></Gather><Say>No PIN entered. Goodbye.</Say>`,
    );
  }

  if (step === "pin") {
    if (!secureEquals(VOICE_PIN, params.get("Digits") ?? "")) return hangUp("Wrong PIN. Goodbye.");
    return twiml(
      `<Say>Describe the feature after the beep. Press hash when you are done.</Say>` +
        `<Record maxLength="120" finishOnKey="#" playBeep="true" transcribe="true" ` +
        `transcribeCallback="${PUBLIC_BASE}?step=transcript" action="${PUBLIC_BASE}?step=done"/>`,
    );
  }

  if (step === "done") return hangUp("Got it. You will get a text once it is logged. Goodbye.");

  if (step === "transcript") {
    const transcript = (params.get("TranscriptionText") ?? "").trim().slice(0, 4000);
    const callSid = params.get("CallSid") ?? "";
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await admin.from("voice_requests").select("id", { count: "exact", head: true }).gte("created_at", since);
    if ((count ?? 0) >= DAILY_LIMIT) {
      await sendSms(OWNER_PHONE, "Loyalty Loop line: daily limit reached, request not logged.");
      return new Response("ok");
    }

    if (params.get("TranscriptionStatus") !== "completed" || !transcript) {
      await sendSms(OWNER_PHONE, "Loyalty Loop line: couldn't transcribe that call. Please try again.");
      return new Response("ok");
    }

    const { error } = await admin.from("voice_requests").upsert(
      { call_sid: callSid, transcript, status: "new" },
      { onConflict: "call_sid", ignoreDuplicates: true },
    );
    await sendSms(
      OWNER_PHONE,
      error ? "Loyalty Loop line: failed to save your request." : `Loyalty Loop line: logged "${transcript.slice(0, 120)}"`,
    );
    return new Response("ok");
  }

  return new Response("Unknown step", { status: 400 });
});
