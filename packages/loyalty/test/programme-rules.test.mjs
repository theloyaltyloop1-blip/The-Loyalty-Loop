import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  cashFor, describeRules, levelFor, pointsForVisit, rulesNeedBill, validateRules,
} from "../src/programme-rules.ts";

// The owner's example: "3 points is £1 off", plus a few extras an AI might add.
const cafe = {
  version: 1,
  unit: { one: "bean", many: "beans" },
  earn: [
    { label: "Per pound", per_pound: 1 },
    { label: "Early bird", multiplier: 2, when: { days: [1, 2, 3, 4, 5], from: "07:00", to: "09:00" } },
    { label: "Big shop", per_visit: 5, when: { min_spend_pence: 2000 } },
    { label: "Gold bonus", per_visit: 3, when: { levels: ["gold"] } },
  ],
  bonuses: { signup: 3, birthday: 10 },
  cash_value: { points: 3, pence: 100, max_pence_per_visit: 1000 },
  rewards: [
    { key: "coffee", title: "Free coffee", points_cost: 12 },
    { key: "tenth", title: "Free pastry", discount_pence: 350 },
  ],
  milestones: [{ label: "Every 10th visit", reward: "tenth", every_visits: 10 }],
  levels: [
    { key: "silver", name: "Silver", min_visits: 10, multiplier: 1.5 },
    { key: "gold", name: "Gold", min_visits: 25, multiplier: 2, perks: ["Free oat milk"] },
  ],
  expiry: { inactive_months: 12 },
  caps: { max_points_per_visit: 200 },
  summary: "Earn a bean per £1, double before 9am on weekdays. 3 beans = £1 off.",
};

const visit = (over = {}) => ({ pence: 1000, visitNumber: 3, day: 6, time: "12:00", date: "2026-11-07", level: null, ...over });

test("a full café programme is accepted and cleaned", () => {
  const r = validateRules({ ...cafe, summary: "  padded  " });
  assert.equal(r.ok, true);
  assert.equal(r.rules.summary, "padded");
  assert.deepEqual(r.rules.cash_value, { points: 3, pence: 100, max_pence_per_visit: 1000 });
});

test("the simplest '3 points = £1' programme is accepted", () => {
  const r = validateRules({
    version: 1, unit: { one: "point", many: "points" },
    earn: [{ label: "1 per £1", per_pound: 1 }], cash_value: { points: 3, pence: 100 },
    rewards: [], summary: "1 point per £1. 3 points = £1 off.",
  });
  assert.equal(r.ok, true, JSON.stringify(r.errors));
});

test("bad rules are refused with readable errors", () => {
  const cases = [
    [{ ...cafe, version: 2 }, "version"],
    [{ ...cafe, extra: true }, 'unknown field "extra"'],
    [{ ...cafe, earn: [{ label: "x", per_pound: 1, per_visit: 1 }] }, "exactly one of per_pound"],
    [{ ...cafe, earn: [{ label: "x", multiplier: 50 }] }, "multiplier"],
    [{ ...cafe, earn: [{ label: "x", per_visit: 1, when: { from: "07:00" } }] }, "both from and to"],
    [{ ...cafe, earn: [{ label: "x", per_visit: 1, when: { days: [7] } }] }, "days"],
    [{ ...cafe, earn: [{ label: "x", per_visit: 1, when: { levels: ["platinum"] } }] }, "existing level keys"],
    [{ ...cafe, earn: [{ label: "x", per_visit: 1, when: { start_date: "2026-02-30" } }] }, "YYYY-MM-DD"],
    [{ ...cafe, rewards: [{ key: "A B", title: "x", points_cost: 1 }] }, "lower-case"],
    [{ ...cafe, rewards: [{ key: "a", title: "x", points_cost: 1, discount_pence: 1, discount_percent: 1 }] }, "not both"],
    [{ ...cafe, rewards: [...cafe.rewards, { key: "orphan", title: "Nobody gives this" }] }, "no points_cost and no milestone"],
    [{ ...cafe, milestones: [{ label: "x", reward: "nope", every_visits: 2 }] }, "reward must name"],
    [{ ...cafe, levels: [{ key: "a", name: "A", min_visits: 1 }, { key: "b", name: "B", min_spend_12m_pence: 100 }] }, "same measure"],
    [{ ...cafe, cash_value: { points: 3, pence: 100, max_pence_per_visit: 50 } }, "below one step"],
    [{ ...cafe, earn: [], milestones: [], bonuses: undefined }, "at least one way to earn"],
    [{ ...cafe, rewards: [], milestones: [], cash_value: null, levels: undefined, earn: [{ label: "x", per_pound: 1 }] }, "at least one reward"],
    [{ ...cafe, summary: "" }, "summary"],
  ];
  for (const [rules, needle] of cases) {
    const r = validateRules(rules);
    assert.equal(r.ok, false, needle);
    assert.ok(r.errors.some((e) => e.includes(needle)), `${needle} not in ${JSON.stringify(r.errors)}`);
  }
});

test("points for a visit: base, best multiplier, level multiplier, cap", () => {
  const rules = validateRules(cafe).rules;
  // £10 on Saturday lunchtime: 10 beans.
  assert.equal(pointsForVisit(rules, visit()), 10);
  // £10 on Monday 07:30: early-bird doubles it.
  assert.equal(pointsForVisit(rules, visit({ day: 1, time: "07:30" })), 20);
  // £25: 25 + 5 big-shop bonus.
  assert.equal(pointsForVisit(rules, visit({ pence: 2500 })), 30);
  // Gold at £10 Monday early: (10 + 3) × max(2, 2) = 26 (multipliers do not stack).
  assert.equal(pointsForVisit(rules, visit({ day: 1, time: "07:30", level: "gold" })), 26);
  // Silver ×1.5 on £9.99 → floor(9 × 1.5) = 13.
  assert.equal(pointsForVisit(rules, visit({ pence: 999, level: "silver" })), 13);
  // Cap.
  assert.equal(pointsForVisit(rules, visit({ pence: 100000 })), 200);
});

test("time windows can wrap past midnight", () => {
  const rules = validateRules({
    ...cafe, earn: [{ label: "late", per_visit: 4, when: { from: "22:00", to: "02:00" } }],
  }).rules;
  assert.equal(pointsForVisit(rules, visit({ time: "23:15" })), 4);
  assert.equal(pointsForVisit(rules, visit({ time: "01:59" })), 4);
  assert.equal(pointsForVisit(rules, visit({ time: "02:00" })), 0);
});

test("levels, cash value and bill check", () => {
  const rules = validateRules(cafe).rules;
  assert.equal(levelFor(rules, 9, 0), null);
  assert.equal(levelFor(rules, 10, 0).key, "silver");
  assert.equal(levelFor(rules, 30, 0).key, "gold");
  assert.deepEqual(cashFor(rules, 10), { points: 9, pence: 300 });
  assert.deepEqual(cashFor(rules, 100), { points: 30, pence: 1000 });
  assert.equal(rulesNeedBill(rules), true);
  const visitsOnly = validateRules({ ...cafe, earn: [{ label: "visit", per_visit: 1 }] }).rules;
  assert.equal(rulesNeedBill(visitsOnly), false);
});

test("describeRules reads like a person wrote it", () => {
  const d = describeRules(validateRules(cafe).rules);
  assert.equal(d.earn[0], "1 bean per £1 spent");
  assert.equal(d.earn[1], "2× beans on Mon, Tue, Wed, Thu, Fri, 07:00–09:00");
  assert.ok(d.spend.includes("3 beans = £1 off (up to £10 per visit)"));
  assert.ok(d.spend.includes("Free coffee for 12 beans"));
  assert.ok(d.spend.includes("Free pastry (£3.50 off) every 10 visits"));
  assert.equal(d.levels[1], "Gold at 25 visits: 2× beans, Free oat milk");
  assert.ok(d.small.includes("Beans expire after 12 months without a visit"));
});

test("the Deno copy is identical", () => {
  const a = readFileSync(new URL("../src/programme-rules.ts", import.meta.url), "utf8");
  const b = readFileSync(new URL("../../../supabase/functions/_shared/programme-rules.ts", import.meta.url), "utf8");
  assert.equal(a, b, "copy packages/loyalty/src/programme-rules.ts to supabase/functions/_shared/");
});
