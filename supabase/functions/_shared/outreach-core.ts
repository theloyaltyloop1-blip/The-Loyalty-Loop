// Outreach bot rules, ported line by line from the local bot
// (marketing/outreach-bot/lib.mjs and server.mjs). Pure functions, no I/O.
//
// This file is copied byte for byte to apps/web/src/lib/outreach-core.ts so the
// admin page shows exactly what the sender will do. A test enforces the copy:
// supabase/functions/_shared/outreach-core.test.mjs. Change both together.

export const DAY = 86_400_000;

export const STEPS = [
  { key: "pain", label: "Email 1 · pain points", file: "email-1-pain.txt" },
  { key: "features", label: "Email 2 · features", file: "email-2-features.txt" },
  { key: "story", label: "Email 3 · your story", file: "email-3-story.txt" },
] as const;
export type StepKey = (typeof STEPS)[number]["key"];

export type Lead = {
  email: string;
  allEmails: string[];
  shop: string;
  firstName: string;
  shopType: string;
  area: string;
  linkedin: string;
  instagram: string;
  legalEntity: string;
  companyNumber: string;
  emailOk: boolean;
};

export type SentStep = { step: number; stepKey: string; sentAt: string; messageId: string | null };
export type LeadEntry = { shop: string; steps: SentStep[]; stopped: { reason: string; at: string } | null };
export type StateMap = Record<string, LeadEntry>;

export type Links = { bookingLink: string; signupLink: string; website: string; senderName: string };

export type Status = "do-not-contact" | "no-consent" | "stopped" | "emailed-before" | "due" | "waiting" | "finished";

export type BoardRow = Lead & {
  status: Status;
  dueStep: number | null;
  stepsSent: { step: string; sentAt: string }[];
  stopped: { reason: string; at: string } | null;
  nextDueAt: string | null;
};

export const norm = (e: unknown) => String(e ?? "").trim().toLowerCase();
export const splitEmails = (s: unknown) => String(s ?? "").split(/[;,\s]+/).map(norm).filter((x) => x.includes("@"));

// ---------- time (London) ----------
export const londonDate = (d: Date = new Date()) => d.toLocaleDateString("en-GB", { timeZone: "Europe/London" });

export function londonClock(d: Date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", hour: "numeric", hour12: false, weekday: "short",
  }).formatToParts(d).map((p) => [p.type, p.value]));
  return { hour: Number(parts.hour) % 24, weekday: String(parts.weekday) };
}

export type Window = { startHour: number; endHour: number; weekdaysOnly: boolean };

export function windowOpen(s: Window, d: Date = new Date()) {
  const { hour, weekday } = londonClock(d);
  if (s.weekdaysOnly && (weekday === "Sat" || weekday === "Sun")) return false;
  return hour >= s.startHour && hour < s.endHour;
}

export function sentToday(state: StateMap, now: Date = new Date()) {
  const today = londonDate(now);
  return Object.values(state).flatMap((l) => l.steps).filter((s) => londonDate(new Date(s.sentAt)) === today).length;
}

// ---------- sequence ----------
// Which step is due for this lead now (0-2), or null.
export function dueStep(entry: LeadEntry | undefined, gaps: number[], now: number = Date.now()): number | null {
  const n = entry?.steps.length ?? 0;
  if (n >= STEPS.length) return null;
  if (n === 0 || !entry) return 0;
  return now - new Date(entry.steps[n - 1].sentAt).getTime() >= gaps[n - 1] * DAY ? n : null;
}

export function nextDueAt(entry: LeadEntry | undefined, gaps: number[]): string | null {
  const n = entry?.steps.length ?? 0;
  if (!n || n >= STEPS.length || !entry) return null;
  return new Date(new Date(entry.steps[n - 1].sentAt).getTime() + gaps[n - 1] * DAY).toISOString();
}

// Every lead with its status, plus the ordered send queue. `leads` must be in
// file order; rows without an email and repeat emails are skipped as in lib.mjs.
export function buildBoard(
  leads: Lead[],
  state: StateMap,
  blocked: Set<string>,
  excluded: Set<string>,
  gaps: number[],
  now: number = Date.now(),
) {
  const seen = new Set<string>();
  const rows: BoardRow[] = [];
  const queue: { lead: Lead; step: number }[] = [];
  for (const l of leads) {
    if (!l.email || seen.has(l.email)) continue;
    seen.add(l.email);
    const e = state[l.email];
    let status: Status;
    let step: number | null = null;
    if (l.allEmails.some((x) => blocked.has(x))) status = "do-not-contact";
    else if (!l.emailOk) status = "no-consent";
    else if (e?.stopped) status = "stopped";
    else if (!e && l.allEmails.some((x) => excluded.has(x))) status = "emailed-before";
    else {
      step = dueStep(e, gaps, now);
      if (step !== null) { status = "due"; queue.push({ lead: l, step }); }
      else status = e && e.steps.length >= STEPS.length ? "finished" : "waiting";
    }
    rows.push({
      ...l,
      status,
      dueStep: step,
      stepsSent: e?.steps.map((s) => ({ step: s.stepKey, sentAt: s.sentAt })) ?? [],
      stopped: e?.stopped ?? null,
      nextDueAt: status === "waiting" ? nextDueAt(e, gaps) : null,
    });
  }
  queue.sort((a, b) => b.step - a.step); // follow-ups before new leads (stable)
  return { rows, queue };
}

// ---------- templates ----------
export function vars(l: { shop: string; shopType: string; area: string; firstName: string }, links: Links): Record<string, string> {
  return {
    ShopName: l.shop,
    ShopType: l.shopType,
    Area: l.area,
    FirstName: l.firstName,
    FirstNameOrThere: l.firstName || "there",
    Greeting: l.firstName ? `Hi ${l.firstName},` : `Hi ${l.shop} team,`,
    BookingLink: links.bookingLink,
    SignupLink: links.signupLink,
    Website: links.website,
    SenderName: links.senderName,
  };
}

export const fill = (t: string, v: Record<string, string>) => t.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in v ? v[k] : m));

export function render(template: string, lead: { shop: string; shopType: string; area: string; firstName: string }, links: Links) {
  const [first, ...rest] = template.split(/\r?\n/);
  return {
    subject: fill(first.replace(/^Subject:\s*/i, ""), vars(lead, links)),
    text: fill(rest.join("\n").trim(), vars(lead, links)) + "\n",
  };
}

export function problems(msg: { subject: string; text: string }) {
  const p: string[] = [];
  if (/\[EDIT/i.test(msg.text)) p.push("template still has an [EDIT ...] placeholder");
  const left = (msg.subject + msg.text).match(/\{\{\w+\}\}/g);
  if (left) p.push(`unfilled ${[...new Set(left)].join(" ")}`);
  return p;
}

// Every email must carry the "reply no" line (lib.mjs relies on the template
// having it; the online sender refuses to send without it).
export const hasOptOutLine = (text: string) => /reply\s+["“']?no["”']?/i.test(text);

export function listUnsubscribe(fromEmail: string) {
  return `<mailto:${fromEmail}?subject=unsubscribe>`;
}

// ---------- linkedin ----------
export function linkedinTexts(json: string, lead: Lead, angle: string, links: Links) {
  const all = JSON.parse(json) as Record<string, { connect: string; message: string }>;
  const tpl = all[angle] || all.pain;
  return { connect: fill(tpl.connect, vars(lead, links)), message: fill(tpl.message, vars(lead, links)) };
}

export function linkedinSearch(lead: Lead) {
  return lead.linkedin || `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(`${lead.shop} ${lead.area}`)}`;
}

// ---------- instagram ----------
export function igHandle(v: unknown) {
  const m = String(v ?? "").trim().match(/(?:instagram\.com\/)?@?([A-Za-z0-9._]{1,30})\/?(?:\?.*)?$/);
  return m && !/^(p|reel|explore|stories)$/i.test(m[1]) ? m[1].toLowerCase() : "";
}

export type IgShop = {
  handle: string; shop: string; shopType: string; area: string; email: string;
  company: boolean; entity: string; companyNumber: string;
};

// Shops with an Instagram account. Ltd companies can be DMed cold; others need checking first (PECR).
export function instagramShops(leads: Lead[], blocked: Set<string>): IgShop[] {
  const seen = new Set<string>();
  const out: IgShop[] = [];
  for (const r of leads) {
    const handle = igHandle(r.instagram);
    if (!handle || seen.has(handle)) continue;
    seen.add(handle);
    if (r.allEmails.some((x) => blocked.has(x))) continue;
    const entity = (r.legalEntity || "").toLowerCase();
    out.push({
      handle,
      shop: r.shop,
      shopType: r.shopType,
      area: r.area,
      email: r.allEmails[0] || "",
      company: entity === "ltd" || entity === "plc" || entity === "llp",
      entity: entity || "not checked",
      companyNumber: r.companyNumber,
    });
  }
  return out;
}

const hashPick = <T>(key: string, arr: T[]): T => arr[[...key].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % arr.length];

export type IgItem = { handle: string; shop?: string; name?: string; shopType?: string; area?: string; liked?: string };

export function instagramTexts(json: string, kind: "shops" | "reviewers", item: IgItem, links: Links) {
  const all = JSON.parse(json) as Record<string, { opener: string | string[]; followup: string; interested: string }>;
  const t = all[kind];
  const v = {
    ...vars({ shop: item.shop || item.name || item.handle, shopType: item.shopType || "", area: item.area || "London", firstName: "" }, links),
    Name: item.name ? item.name.split(/\s+/)[0] : "there",
    Liked: item.liked || "your posts on London's independent spots",
  };
  const opener = Array.isArray(t.opener) ? hashPick(item.handle, t.opener) : t.opener;
  return { opener: fill(opener, v), followup: fill(t.followup, v), interested: fill(t.interested, v) };
}

// Same checks the local dashboard ran before saving a JSON template.
export function templateError(key: string, content: string): string | null {
  try {
    if (key === "instagram.json") {
      const parsed = JSON.parse(content);
      for (const a of ["shops", "reviewers"]) if (!parsed[a]?.opener || !parsed[a]?.followup || !parsed[a]?.interested) return `instagram.json needs "${a}" with "opener", "followup" and "interested"`;
    } else if (key === "linkedin.json") {
      const parsed = JSON.parse(content);
      for (const a of ["pain", "features", "story"]) if (!parsed[a]?.connect || !parsed[a]?.message) return `linkedin.json needs "${a}" with "connect" and "message"`;
    } else if (!/^Subject:/i.test(content)) return 'The first line must start with "Subject:"';
  } catch (e) {
    return `Not valid JSON: ${(e as Error).message}`;
  }
  return null;
}
