#!/usr/bin/env node
// One-off import of the local outreach bot's data into the online tables
// (migration 20261117120000_outreach_bot.sql). Lead data goes into the
// database only: nothing is written to the repo, and only counts are printed.
//
// Run from the main project folder (where marketing/outreach-bot and
// marketing/london-leads live, untracked):
//
//   node scripts/outreach-import.mjs                 dry run: reads everything, prints counts, writes nothing
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/outreach-import.mjs --apply
//
// Options: --root <project folder> (default: current folder).
// Safe to run twice: leads of each list are replaced, everything else is
// merged (sent emails and do-not-contact rows are never removed or duplicated).
// The mailbox password in .env is NOT imported: set it as a Supabase secret.

import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const ROOT = path.resolve(args.includes("--root") ? args[args.indexOf("--root") + 1] : process.cwd());
const BOT = path.join(ROOT, "marketing", "outreach-bot");
const LEADS_DIR = path.join(ROOT, "marketing", "london-leads");

// ---------- the local bot's own parsing (lib.mjs) ----------
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((v) => v !== "")) rows.push(row);
  if (!rows.length) return [];
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim().replace(/^﻿/, ""), (r[i] ?? "").trim()])));
}
const readCsv = (f) => (fs.existsSync(f) ? parseCsv(fs.readFileSync(f, "utf8")) : []);
const norm = (e) => String(e || "").trim().toLowerCase();
const pick = (r, ...keys) => { for (const k of keys) if (r[k]) return r[k]; return ""; };
const splitEmails = (s) => String(s || "").split(/[;,\s]+/).map(norm).filter((x) => x.includes("@"));
function igHandle(v) {
  const m = String(v || "").trim().match(/(?:instagram\.com\/)?@?([A-Za-z0-9._]{1,30})\/?(?:\?.*)?$/);
  return m && !/^(p|reel|explore|stories)$/i.test(m[1]) ? m[1].toLowerCase() : "";
}

function readEnv() {
  const out = {};
  const f = path.join(BOT, ".env");
  if (fs.existsSync(f)) for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

// ---------- build rows ----------
function leadRows(list, file) {
  const seen = new Set();
  const out = [];
  readCsv(file).forEach((r) => {
    const all = splitEmails(pick(r, "Email", "email"));
    const email = all[0] || "";
    if (email && seen.has(email)) return; // lib.mjs keeps the first row per email
    if (email) seen.add(email);
    const owner = pick(r, "FirstName", "decision_maker");
    out.push({
      list,
      position: out.length,
      email,
      all_emails: all,
      shop: pick(r, "ShopName", "name", "Name"),
      first_name: owner.split(/\s+/)[0] || "",
      shop_type: (pick(r, "ShopType", "sub_type", "category") || "shop").toLowerCase(),
      area: pick(r, "Area", "borough", "Borough") || "London",
      linkedin_url: pick(r, "LinkedIn", "linkedin"),
      instagram_handle: igHandle(r.instagram || r.Instagram),
      legal_entity: r.legal_entity || "",
      company_number: r.company_number || "",
      email_ok: r.email_ok === undefined ? true : r.email_ok.toLowerCase() === "yes",
    });
  });
  return out;
}

const env = readEnv();
const relRoot = (p) => path.resolve(ROOT, p);
const dncFile = relRoot(env.DO_NOT_CONTACT || "marketing/london-leads/outreach/do-not-contact.csv");
const excludeFiles = (env.EXCLUDE_FILES || "").split(",").map((s) => s.trim()).filter(Boolean).map(relRoot);

const lists = { "email-ok": path.join(LEADS_DIR, "email-ok.csv"), leads: path.join(LEADS_DIR, "leads.csv") };
for (const [name, f] of Object.entries(lists)) if (!fs.existsSync(f)) throw new Error(`Missing leads file for list "${name}"`);
const leads = Object.entries(lists).flatMap(([list, f]) => leadRows(list, f));

const dnc = new Map();
for (const r of readCsv(dncFile)) for (const e of splitEmails(pick(r, "Email", "email"))) {
  if (!dnc.has(e)) dnc.set(e, { email: e, shop: r.ShopName || "", reason: r.Reason || "", ...(r.Date ? { created_at: `${r.Date}T12:00:00Z` } : {}) });
}
const excluded = new Map();
for (const f of excludeFiles) for (const r of readCsv(f)) for (const e of splitEmails(pick(r, "Email", "email"))) {
  if (!excluded.has(e)) excluded.set(e, { email: e, source: path.basename(f) });
}

const statePath = path.join(BOT, "state.json");
const state = { leads: {}, linkedin: {}, instagram: {}, log: [], ...(fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, "utf8")) : {}) };
const STEP_KEYS = ["pain", "features", "story"];
const leadState = [], sends = [];
for (const [email, e] of Object.entries(state.leads)) {
  leadState.push({ email: norm(email), shop: e.shop || "", stopped_reason: e.stopped?.reason ?? null, stopped_at: e.stopped?.at ?? null });
  (e.steps || []).forEach((s, i) => sends.push({
    email: norm(email), step: Math.max(i, STEP_KEYS.indexOf(s.step)), step_key: s.step, shop: e.shop || "", sent_at: s.sentAt, message_id: s.messageId ?? null,
  }));
}
const linkedin = Object.entries(state.linkedin).map(([email, v]) => ({ email: norm(email), requested: v.requested ?? null, accepted: v.accepted ?? null, messaged: v.messaged ?? null }));
const instagram = Object.entries(state.instagram).map(([handle, v]) => ({ handle, sent: v.sent ?? null, followed_up: v.followedUp ?? null, replied: v.replied ?? null, no: v.no ?? null }));
const reviewers = readCsv(path.join(BOT, "reviewers.csv")).map((r) => ({ handle: igHandle(r.Handle), name: r.Name || "", area: r.Area || "", liked: r.Liked || "", added: r.Added || undefined })).filter((r) => r.handle);
const logRows = (state.log || []).map((l) => ({ at: l.at, type: l.type, text: l.text }));

const TEMPLATE_KEYS = ["email-1-pain.txt", "email-2-features.txt", "email-3-story.txt", "linkedin.json", "instagram.json"];
const templates = TEMPLATE_KEYS.map((key) => ({ key, content: fs.readFileSync(path.join(BOT, "templates", key), "utf8").replace(/\r\n/g, "\n") }));

const localSettings = fs.existsSync(path.join(BOT, "settings.json")) ? JSON.parse(fs.readFileSync(path.join(BOT, "settings.json"), "utf8")) : {};
const listName = (file) => (/email-ok\.csv$/.test(file || "") ? "email-ok" : /leads\.csv$/.test(file || "") ? "leads" : undefined);
const settings = Object.fromEntries(Object.entries({
  // auto_send is never imported: it stays off until the owner switches it on.
  leads_list: listName(localSettings.leadsFile),
  instagram_list: listName(localSettings.instagramLeadsFile),
  start_hour: localSettings.startHour,
  end_hour: localSettings.endHour,
  weekdays_only: localSettings.weekdaysOnly,
  linkedin_angle: localSettings.linkedinAngle,
  linkedin_daily_limit: localSettings.linkedinDailyLimit,
  instagram_daily_limit: localSettings.instagramDailyLimit,
  daily_limit: env.DAILY_LIMIT ? Number(env.DAILY_LIMIT) : undefined,
  min_delay_seconds: env.MIN_DELAY_SECONDS ? Number(env.MIN_DELAY_SECONDS) : undefined,
  max_delay_seconds: env.MAX_DELAY_SECONDS ? Number(env.MAX_DELAY_SECONDS) : undefined,
  followup_gap_days: env.FOLLOWUP_GAP_DAYS ? env.FOLLOWUP_GAP_DAYS.split(",").map(Number) : undefined,
  sender_name: env.SENDER_NAME,
  from_email: env.FROM_EMAIL,
  booking_link: env.BOOKING_LINK,
  signup_link: env.SIGNUP_LINK,
  website: env.WEBSITE,
}).filter(([, v]) => v !== undefined && v !== ""));

// ---------- report ----------
const count = (list) => leads.filter((l) => l.list === list).length;
console.log(`${APPLY ? "APPLY" : "DRY RUN (nothing written)"} from ${ROOT}`);
console.log(`  leads: email-ok ${count("email-ok")}, leads ${count("leads")}`);
console.log(`  do-not-contact ${dnc.size}, excluded (earlier batches) ${excluded.size}`);
console.log(`  lead state ${leadState.length} (stopped ${leadState.filter((s) => s.stopped_reason).length}), sent emails ${sends.length}`);
console.log(`  linkedin ${linkedin.length}, instagram ${instagram.length}, reviewers ${reviewers.length}, log ${logRows.length}`);
console.log(`  templates ${templates.length}, settings: ${Object.keys(settings).join(", ") || "(defaults)"}`);
console.log(`  mail server in .env: port ${env.SMTP_PORT || "?"}${env.SMTP_PORT === "587" ? " (blocked online: set OUTREACH_SMTP_PORT=465)" : ""}`);
if (!APPLY) process.exit(0);

// ---------- write (service role, PostgREST) ----------
const URL_ = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for --apply.");
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

async function rest(method, pathAndQuery, body, prefer) {
  const res = await fetch(`${URL_}/rest/v1/${pathAndQuery}`, { method, headers: { ...headers, ...(prefer ? { Prefer: prefer } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(`${method} ${pathAndQuery.split("?")[0]}: ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res;
}
async function insert(table, rows, { conflict, merge }) {
  for (let i = 0; i < rows.length; i += 500) {
    await rest("POST", `${table}?on_conflict=${conflict}`, rows.slice(i, i + 500), `resolution=${merge ? "merge" : "ignore"}-duplicates,return=minimal`);
  }
}

for (const list of Object.keys(lists)) await rest("DELETE", `outreach_leads?list=eq.${list}`);
await insert("outreach_leads", leads, { conflict: "list,position", merge: true });
await insert("outreach_do_not_contact", [...dnc.values()], { conflict: "email", merge: false });
await insert("outreach_excluded", [...excluded.values()], { conflict: "email", merge: false });
await insert("outreach_lead_state", leadState, { conflict: "email", merge: true });
await insert("outreach_sends", sends, { conflict: "email,step", merge: false });
await insert("outreach_linkedin", linkedin, { conflict: "email", merge: true });
await insert("outreach_instagram", instagram, { conflict: "handle", merge: true });
await insert("outreach_reviewers", reviewers, { conflict: "handle", merge: true });
await insert("outreach_templates", templates, { conflict: "key", merge: true });
const existingLog = await (await rest("GET", "outreach_log?select=id&limit=1")).json();
if (!existingLog.length) await insert("outreach_log", logRows, { conflict: "id", merge: false });
await insert("outreach_log", [{ type: "import", text: `Imported from the laptop bot: ${leads.length} lead rows, ${sends.length} sent emails, ${dnc.size} do-not-contact` }], { conflict: "id", merge: false });
if (Object.keys(settings).length) await rest("PATCH", "outreach_settings?id=eq.true", { ...settings, updated_at: new Date().toISOString() }, "return=minimal");
console.log("Done. Auto-send is still off.");
