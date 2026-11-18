import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { DAY, buildBoard, dueStep, hasOptOutLine, igHandle, instagramShops, problems, render, sentToday, templateError, windowOpen } from "./outreach-core.ts";

const links = { bookingLink: "https://book", signupLink: "https://signup", website: "https://site", senderName: "Sam" };
const lead = (email, extra = {}) => ({
  email, allEmails: [email], shop: `Shop ${email[0]}`, firstName: "", shopType: "café", area: "Brixton",
  linkedin: "", instagram: "", legalEntity: "", companyNumber: "", emailOk: true, ...extra,
});
const sent = (stepKeys, at) => ({ shop: "", stopped: null, steps: stepKeys.map((k, i) => ({ step: i, stepKey: k, sentAt: at, messageId: `<m${i}@x>` })) });
const NOW = Date.parse("2026-11-18T10:00:00Z");

test("web copy is byte for byte the same as the edge function copy", () => {
  const a = readFileSync(new URL("./outreach-core.ts", import.meta.url), "utf8");
  const b = readFileSync(new URL("../../../apps/web/src/lib/outreach-core.ts", import.meta.url), "utf8");
  assert.equal(a, b);
});

test("statuses follow the local bot's order of checks", () => {
  const leads = [
    lead("a@x.com"), // new -> due step 0
    lead("b@x.com", { allEmails: ["b@x.com", "dnc@x.com"] }), // second address blocked
    lead("c@x.com", { emailOk: false }),
    lead("d@x.com"), // stopped
    lead("e@x.com"), // excluded, never emailed by the bot
    lead("f@x.com"), // excluded but already in the sequence -> carries on
    lead("g@x.com"), // all three sent
    lead("h@x.com"), // email 1 sent yesterday -> waiting
    lead("a@x.com"), // repeat email in the file -> skipped
    lead(""), // no email -> skipped
  ];
  const state = {
    "d@x.com": { shop: "", steps: [], stopped: { reason: "Said no", at: "x" } },
    "f@x.com": sent(["pain"], new Date(NOW - 4 * DAY).toISOString()),
    "g@x.com": sent(["pain", "features", "story"], new Date(NOW - 20 * DAY).toISOString()),
    "h@x.com": sent(["pain"], new Date(NOW - 1 * DAY).toISOString()),
  };
  const { rows, queue } = buildBoard(leads, state, new Set(["dnc@x.com"]), new Set(["e@x.com", "f@x.com"]), [3, 4], NOW);
  assert.deepEqual(rows.map((r) => r.status), ["due", "do-not-contact", "no-consent", "stopped", "emailed-before", "due", "finished", "waiting"]);
  assert.equal(rows.find((r) => r.email === "h@x.com").nextDueAt, new Date(NOW - DAY + 3 * DAY).toISOString());
  // follow-ups first
  assert.deepEqual(queue.map((q) => [q.lead.email, q.step]), [["f@x.com", 1], ["a@x.com", 0]]);
});

test("follow-up gaps are 3 then 4 days", () => {
  const at = (days) => new Date(NOW - days * DAY).toISOString();
  assert.equal(dueStep(undefined, [3, 4], NOW), 0);
  assert.equal(dueStep(sent(["pain"], at(2.9)), [3, 4], NOW), null);
  assert.equal(dueStep(sent(["pain"], at(3)), [3, 4], NOW), 1);
  assert.equal(dueStep(sent(["pain", "features"], at(3.9)), [3, 4], NOW), null);
  assert.equal(dueStep(sent(["pain", "features"], at(4)), [3, 4], NOW), 2);
  assert.equal(dueStep(sent(["pain", "features", "story"], at(30)), [3, 4], NOW), null);
});

test("templates: fill-ins, greeting, refusal of [EDIT and unfilled fields", () => {
  const m = render("Subject: Hello {{ShopName}}\n\n{{Greeting}}\nBook: {{BookingLink}}\nNot for you? Just reply \"no\".\n", lead("a@x.com"), links);
  assert.equal(m.subject, "Hello Shop a");
  assert.ok(m.text.startsWith("Hi Shop a team,"));
  assert.deepEqual(problems(m), []);
  assert.ok(hasOptOutLine(m.text));
  const named = render("Subject: x\n{{Greeting}}", lead("a@x.com", { firstName: "Ana" }), links);
  assert.equal(named.text, "Hi Ana,\n");
  const bad = render("Subject: {{Oops}}\n[EDIT this] {{Nope}}", lead("a@x.com"), links);
  assert.deepEqual(problems(bad), ["template still has an [EDIT ...] placeholder", "unfilled {{Oops}} {{Nope}}"]);
  assert.equal(hasOptOutLine("no opt out here"), false);
});

test("sending window is London time, weekdays only", () => {
  const w = { startHour: 9, endHour: 16, weekdaysOnly: true };
  assert.equal(windowOpen(w, new Date("2026-11-18T08:59:00Z")), false); // Wed 08:59 GMT
  assert.equal(windowOpen(w, new Date("2026-11-18T09:00:00Z")), true);
  assert.equal(windowOpen(w, new Date("2026-11-18T16:00:00Z")), false);
  assert.equal(windowOpen(w, new Date("2026-11-21T12:00:00Z")), false); // Saturday
  assert.equal(windowOpen(w, new Date("2026-07-15T08:30:00Z")), true); // 09:30 BST
  assert.equal(windowOpen({ ...w, weekdaysOnly: false }, new Date("2026-11-21T12:00:00Z")), true);
});

test("daily count uses the London calendar day", () => {
  const state = { "a@x.com": sent(["pain"], "2026-11-18T00:30:00Z"), "b@x.com": sent(["pain"], "2026-11-17T23:30:00Z") };
  assert.equal(sentToday(state, new Date("2026-11-18T10:00:00Z")), 1);
});

test("instagram handles and shop list", () => {
  assert.equal(igHandle("https://www.instagram.com/Cafe.Hunter/?hl=en"), "cafe.hunter");
  assert.equal(igHandle("@londonfoodie"), "londonfoodie");
  assert.equal(igHandle("https://instagram.com/p/"), "");
  const shops = instagramShops([
    lead("a@x.com", { instagram: "@one", legalEntity: "Ltd" }),
    lead("b@x.com", { instagram: "@one" }), // repeat handle
    lead("c@x.com", { instagram: "@two", allEmails: ["c@x.com"] }),
    lead("", { allEmails: [], instagram: "@three" }),
  ], new Set(["c@x.com"]));
  assert.deepEqual(shops.map((s) => [s.handle, s.company, s.entity]), [["one", true, "ltd"], ["three", false, "not checked"]]);
});

test("template checks before saving", () => {
  assert.equal(templateError("email-1-pain.txt", "Subject: hi\nbody"), null);
  assert.match(templateError("email-1-pain.txt", "hi"), /Subject/);
  assert.match(templateError("linkedin.json", "{}"), /pain/);
  assert.match(templateError("instagram.json", "{nope"), /Not valid JSON/);
});
