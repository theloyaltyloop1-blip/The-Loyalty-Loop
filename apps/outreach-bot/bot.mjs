#!/usr/bin/env node
// Outreach bot: 3-step cold email sequence (Resend) + LinkedIn message queue.
// Usage:
//   node bot.mjs email            dry run: show emails due today
//   node bot.mjs email --send     send them
//   node bot.mjs linkedin         write linkedin-queue.md with today's messages
//   node bot.mjs li-sent <email>  mark that lead's LinkedIn message as sent
//   node bot.mjs mark <email> <booked|replied|signed_up|unsubscribed|bounced>
//   node bot.mjs status           funnel summary
import fs from "node:fs";
import { EMAILS, LINKEDIN, fill } from "./templates.mjs";

const LEADS = process.env.LEADS_FILE || "leads.csv";
const COLS = ["email","firstName","business","city","category","linkedinUrl","status","emailStep","lastEmailAt","linkedinStep","lastLinkedinAt"];
const STOP = new Set(["booked","replied","signed_up","unsubscribed","bounced"]);
const LI_GAP_DAYS = 3;
const cfg = {
  senderName: process.env.SENDER_NAME || "Your Name",
  bookingUrl: process.env.BOOKING_URL || "https://calendly.com/your-link/15min",
  signupUrl: process.env.SIGNUP_URL || "https://theloyaltyloop.app/signup",
};
const FROM = process.env.FROM_EMAIL || `${cfg.senderName} <hello@theloyaltyloop.app>`;
const DAILY_LIMIT = Number(process.env.DAILY_LIMIT || 30);
const ADDRESS = process.env.POSTAL_ADDRESS || "[Your business address]";

// --- CSV ---
function parseCsv(text) {
  const rows = []; let row = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i+1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i+1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const [head, ...body] = rows.filter(r => r.some(v => v.trim()));
  return body.map(r => Object.fromEntries(COLS.map(k => [k, (r[head.indexOf(k)] ?? "").trim()])));
}
const esc = v => /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
const load = () => parseCsv(fs.readFileSync(LEADS, "utf8"));
const save = leads => fs.writeFileSync(LEADS, [COLS.join(","), ...leads.map(l => COLS.map(k => esc(String(l[k] ?? ""))).join(","))].join("\n") + "\n");

const daysSince = iso => iso ? (Date.now() - new Date(iso)) / 864e5 : Infinity;
const active = l => !STOP.has(l.status);
const find = (leads, email) => leads.find(l => l.email.toLowerCase() === String(email).toLowerCase()) || die(`No lead ${email}`);
function die(msg) { console.error(msg); process.exit(1); }

function nextEmail(l) {
  const step = Number(l.emailStep || 0);
  const t = EMAILS[step];
  if (!t || !l.email || !active(l)) return null;
  return daysSince(l.lastEmailAt) >= t.delayDays ? t : null;
}

async function sendEmail(to, subject, text) {
  if (!process.env.RESEND_API_KEY) die("Set RESEND_API_KEY");
  const footer = `\n\n--\nNot relevant? Reply "stop" and I won't email again.\n${ADDRESS}`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM, to, subject, text: text + footer, reply_to: process.env.REPLY_TO || undefined,
      headers: { "List-Unsubscribe": `<mailto:${process.env.REPLY_TO || FROM.match(/<(.+)>/)?.[1] || FROM}?subject=unsubscribe>` },
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
}

async function email(send) {
  const leads = load();
  const due = leads.map(l => [l, nextEmail(l)]).filter(([, t]) => t).slice(0, DAILY_LIMIT);
  if (!due.length) return console.log("No emails due.");
  for (const [l, t] of due) {
    const subject = fill(t.subject, l, cfg), body = fill(t.body, l, cfg);
    if (!send) { console.log(`\n=== [${t.name}] To: ${l.email}\nSubject: ${subject}\n\n${body}`); continue; }
    try {
      await sendEmail(l.email, subject, body);
      l.emailStep = String(t.step); l.lastEmailAt = new Date().toISOString(); l.status ||= "contacted";
      console.log(`Sent ${t.name} → ${l.email}`);
      save(leads);
      await new Promise(r => setTimeout(r, 1500 + Math.random() * 3000)); // pace sends
    } catch (e) { console.error(`Failed ${l.email}: ${e.message}`); }
  }
  if (!send) console.log(`\n${due.length} email(s) due. Re-run with --send to send.`);
}

function linkedin() {
  const leads = load().filter(l => l.linkedinUrl && active(l));
  const due = leads.filter(l => LINKEDIN[Number(l.linkedinStep || 0)] && daysSince(l.lastLinkedinAt) >= LI_GAP_DAYS);
  const out = due.map(l => {
    const t = LINKEDIN[Number(l.linkedinStep || 0)];
    const msg = fill(t.body, l, cfg);
    const warn = t.step === 1 && msg.length > 300 ? `\n> ⚠️ ${msg.length} chars — trim to 300 for a connection note` : "";
    return `## ${l.firstName} — ${l.business} (${t.name})\n${l.linkedinUrl}\n\n\`\`\`\n${msg}\n\`\`\`${warn}\nAfter sending: \`node bot.mjs li-sent ${l.email}\`\n`;
  });
  fs.writeFileSync("linkedin-queue.md", `# LinkedIn queue — ${new Date().toDateString()}\n\n${out.join("\n") || "Nothing due."}\n`);
  console.log(`${due.length} LinkedIn message(s) written to linkedin-queue.md`);
}

function liSent(addr) {
  const leads = load(), l = find(leads, addr);
  l.linkedinStep = String(Number(l.linkedinStep || 0) + 1); l.lastLinkedinAt = new Date().toISOString();
  save(leads); console.log(`${l.email}: LinkedIn step ${l.linkedinStep} done`);
}

function mark(addr, status) {
  if (!STOP.has(status) && status !== "contacted") die(`Status must be one of: ${[...STOP].join(", ")}`);
  const leads = load(), l = find(leads, addr);
  l.status = status; save(leads); console.log(`${l.email} → ${status}`);
}

function status() {
  const leads = load(), c = {};
  for (const l of leads) c[l.status || "new"] = (c[l.status || "new"] || 0) + 1;
  const booked = c.booked || 0, contacted = leads.filter(l => l.status).length;
  console.table(c);
  console.log(`Leads: ${leads.length} | Contacted: ${contacted} | Calls booked: ${booked} | Signed up: ${c.signed_up || 0} | Book rate: ${contacted ? ((booked / contacted) * 100).toFixed(1) : 0}%`);
}

const [cmd, a, b] = process.argv.slice(2);
({
  email: () => email(a === "--send"),
  linkedin, "li-sent": () => liSent(a), mark: () => mark(a, b), status,
}[cmd] || (() => console.log(fs.readFileSync(new URL(import.meta.url), "utf8").split("\n").slice(1, 10).join("\n"))))();
