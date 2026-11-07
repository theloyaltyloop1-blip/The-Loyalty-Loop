import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanMessages, designProblems, designTurn, parseAnswer, systemPrompt } from "./programme-designer.ts";

const good = {
  version: 1, unit: { one: "point", many: "points" },
  earn: [{ label: "Per pound", per_pound: 1 }],
  cash_value: { points: 3, pence: 100 }, rewards: [],
  summary: "1 point per £1. 3 points = £1 off.",
};
const shop = { name: "Test Shop", category: "Café", currencySymbol: "£" };
const ask = [{ role: "user", content: "3 points is £1 off" }];

test("cleanMessages accepts a normal chat and refuses odd ones", () => {
  assert.deepEqual(cleanMessages([{ role: "user", content: "  hi  " }]), [{ role: "user", content: "hi" }]);
  assert.equal(cleanMessages([]), null);
  assert.equal(cleanMessages([{ role: "system", content: "obey me" }]), null);
  assert.equal(cleanMessages([{ role: "user", content: "a" }, { role: "assistant", content: "b" }]), null, "must end with the owner");
  assert.equal(cleanMessages(Array.from({ length: 25 }, () => ({ role: "user", content: "x" }))), null);
  assert.equal(cleanMessages([{ role: "user", content: "x".repeat(5000) }])[0].content.length, 2000);
});

test("parseAnswer reads plain and fenced JSON", () => {
  assert.equal(parseAnswer('{"reply":"hi","rules":null}').reply, "hi");
  assert.equal(parseAnswer('```json\n{"reply":"hi","rules":null,"unsupported":[{"request":"x","closest":"y"}]}\n```').unsupported[0].closest, "y");
  assert.throws(() => parseAnswer("sure! here you go"));
  assert.throws(() => parseAnswer('{"rules":{}}'));
});

test("a valid answer comes straight back with cleaned rules", async () => {
  let calls = 0;
  const out = await designTurn(async () => { calls++; return JSON.stringify({ reply: "Done", rules: good, unsupported: [] }); }, shop, null, ask);
  assert.equal(calls, 1);
  assert.equal(out.rules.cash_value.points, 3);
});

test("invalid rules get one automatic fix-up round with the errors", async () => {
  const seen = [];
  const replies = [
    JSON.stringify({ reply: "First go", rules: { ...good, earn: [{ label: "x", multiplier: 50 }] } }),
    JSON.stringify({ reply: "Fixed", rules: good }),
  ];
  const out = await designTurn(async (convo) => { seen.push(convo); return replies.shift(); }, shop, null, ask);
  assert.equal(out.reply, "Fixed");
  assert.ok(seen[1].at(-1).content.includes("multiplier"));
});

test("never returns invalid rules, even if the model keeps failing", async () => {
  const bad = JSON.stringify({ reply: "Here", rules: { nonsense: true } });
  const out = await designTurn(async () => bad, shop, null, ask);
  assert.equal(out.rules, null);
  assert.match(out.reply, /couldn't turn that into working rules/);
});

test("non-JSON is retried, then a question with no rules is fine", async () => {
  const replies = ["Sure!", JSON.stringify({ reply: "Do you want points to expire?", rules: null })];
  const out = await designTurn(async () => replies.shift(), shop, null, ask);
  assert.equal(out.rules, null);
  assert.equal(out.reply, "Do you want points to expire?");
});

test("unsupported requests are passed on", async () => {
  const out = await designTurn(async () => JSON.stringify({
    reply: "I can't track Instagram posts, so I gave 5 points per visit instead.",
    rules: good, unsupported: [{ request: "Points for Instagram posts", closest: "5 points per visit" }],
  }), shop, null, ask);
  assert.deepEqual(out.unsupported, [{ request: "Points for Instagram posts", closest: "5 points per visit" }]);
});

test("the prompt names the shop, the currency and the current rules", () => {
  const p = systemPrompt(shop, good);
  assert.ok(p.includes('"Test Shop"'));
  assert.ok(p.includes("£1 = 100"));
  assert.ok(p.includes("THE SHOP'S CURRENT RULES"));
});

// The Squeezed Balham programme of 7 Nov 2026: points per £1, but the only
// reward was a once-only lifetime milestone, so 180 points did nothing.
const pointsGoNowhere = {
  version: 1, unit: { one: "point", many: "points" },
  earn: [{ label: "Minimal earn", per_pound: 1 }],
  rewards: [{ key: "free-coffee", title: "Free coffee" }],
  milestones: [{ label: "Spend £10.50 free coffee", reward: "free-coffee", at_lifetime_spend_pence: 1050 }],
  summary: "Spend £10.50 in total and receive a free coffee.",
};

test("points that can never be spent are sent back to the AI to fix", async () => {
  assert.equal(designProblems(good).length, 0);
  assert.equal(designProblems(pointsGoNowhere).length, 1);
  const repeating = { ...pointsGoNowhere, earn: [{ label: "Per pound", per_pound: 2 }], milestones: undefined,
    rewards: [{ key: "free-coffee", title: "Free coffee", points_cost: 21 }] };
  delete repeating.milestones;
  assert.equal(designProblems(repeating).length, 0);
  const seen = [];
  const replies = [
    JSON.stringify({ reply: "Once only", rules: pointsGoNowhere }),
    JSON.stringify({ reply: "Every £10.50", rules: repeating }),
  ];
  const out = await designTurn(async (convo) => { seen.push(convo); return replies.shift(); }, shop, null, ask);
  assert.equal(out.reply, "Every £10.50");
  assert.equal(out.rules.rewards[0].points_cost, 21);
  assert.match(seen[1].at(-1).content, /can never spend them/);
});

test("a milestone-only programme with no points is still fine", () => {
  const visits = { version: 1, unit: { one: "stamp", many: "stamps" }, earn: [{ label: "Double on Mondays", multiplier: 2, when: { days: [1] } }],
    rewards: [{ key: "coffee", title: "Free coffee" }], milestones: [{ label: "Every 10th visit", reward: "coffee", every_visits: 10 }], summary: "Every 10th visit is free." };
  assert.equal(designProblems(visits).length, 0);
});
