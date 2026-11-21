import assert from "node:assert/strict";
import { test } from "node:test";
import { bouncedAddress, isBounceSender, replyText, snippet, verdictFrom } from "./outreach-replies-core.ts";
import { DAY, buildBoard, dueStep, nextDueAt } from "./outreach-core.ts";

const NOW = new Date("2026-11-23T10:00:00Z");

test("bounce senders and the bounced address", () => {
  assert.ok(isBounceSender("mailer-daemon@googlemail.com"));
  assert.ok(isBounceSender("MAILER-DAEMON@mx.ionos.co.uk"));
  assert.ok(isBounceSender("postmaster@shop.co.uk"));
  assert.equal(isBounceSender("owner@shop.co.uk"), false);
  const sent = new Set(["a@shop.com"]);
  assert.equal(bouncedAddress("Delivery to the following recipient failed: A@Shop.com\nother@x.com", sent), "a@shop.com");
  assert.equal(bouncedAddress("failed: someone@else.com", sent), null);
});

test("reply text drops the quoted original", () => {
  const body = "Thanks, not for us.\n\nOn Mon, 23 Nov 2026 at 09:00, Sam <s@x.com> wrote:\n> Hi Shop team,\n> Quick question";
  assert.equal(replyText(body), "Thanks, not for us.");
  assert.equal(replyText("> only quoted\n> lines"), "");
  assert.equal(replyText("Yes please\n-----Original Message-----\nFrom: me"), "Yes please");
  assert.equal(replyText("x".repeat(5000)).length, 2000);
  assert.equal(snippet("Line one\n\n line two \nthree\nfour"), "Line one line two three");
});

test("AI answers become labels; anything odd or unsure is Needs you", () => {
  assert.deepEqual(verdictFrom('{"label":"Said no","reason":"Not interested","confidence":0.95,"return_date":null}', NOW),
    { label: "Said no", reason: "Not interested", confidence: 0.95, holdUntil: null });
  assert.equal(verdictFrom("not json", NOW).label, "Needs you");
  assert.equal(verdictFrom('{"label":"Bounced","confidence":0.9}', NOW).label, "Needs you"); // AI may not pick Bounced
  assert.equal(verdictFrom('{"label":"Delete everything","confidence":1}', NOW).label, "Needs you");
  const unsure = verdictFrom('{"label":"Interested","reason":"maybe","confidence":0.4}', NOW);
  assert.equal(unsure.label, "Needs you");
  assert.match(unsure.reason, /unsure \(Interested, 40%\)/);
  assert.equal(verdictFrom('{"label":"Interested","reason":"x"}', NOW).label, "Needs you"); // no confidence
  const ooo = verdictFrom('{"label":"Out of office","reason":"away","confidence":0.9,"return_date":"2026-11-30"}', NOW);
  assert.equal(ooo.holdUntil, "2026-11-30T09:00:00.000Z");
  assert.equal(verdictFrom('{"label":"Out of office","confidence":0.9,"return_date":"2027-06-01"}', NOW).holdUntil, null); // too far
  assert.equal(verdictFrom('{"label":"Out of office","confidence":0.9,"return_date":"2026-11-01"}', NOW).holdUntil, null); // past
});

test("an out-of-office hold delays the next email, then it carries on", () => {
  const now = NOW.getTime();
  const entry = { shop: "", stopped: null, steps: [{ step: 0, stepKey: "pain", sentAt: new Date(now - 4 * DAY).toISOString(), messageId: "<a>" }] };
  assert.equal(dueStep(entry, [3, 4], now), 1);
  const held = { ...entry, holdUntil: new Date(now + 2 * DAY).toISOString() };
  assert.equal(dueStep(held, [3, 4], now), null);
  assert.equal(dueStep(held, [3, 4], now + 2 * DAY + 1), 1);
  assert.equal(nextDueAt(held, [3, 4]), held.holdUntil);
  const lead = { email: "a@x.com", allEmails: ["a@x.com"], shop: "A", firstName: "", shopType: "café", area: "x", linkedin: "", instagram: "", legalEntity: "", companyNumber: "", emailOk: true };
  const { rows, queue } = buildBoard([lead], { "a@x.com": held }, new Set(), new Set(), [3, 4], now);
  assert.equal(rows[0].status, "waiting");
  assert.equal(queue.length, 0);
});
