import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PROGRAMMES, pointsEarned, pointsPerPound, pointsStanding, programmeIdFor, recordsSpend, tierStanding,
} from "../src/index.ts";

const ladder = [
  { name: "Gold", spend_threshold_pence: 50000, perks: ["Priority booking"] },
  { name: "Silver", spend_threshold_pence: 25000, perks: [] },
  { name: "Platinum", spend_threshold_pence: 100000 },
];

test("all four programmes resolve from their own model and know whether they record spend", () => {
  assert.deepEqual(Object.keys(PROGRAMMES).sort(), ["points", "spend", "stamps", "tiers"]);
  for (const programme of Object.values(PROGRAMMES)) {
    assert.equal(programmeIdFor(programme.model), programme.id);
    assert.equal(recordsSpend({ reward_model: programme.model }), programme.recordsSpend);
  }
  assert.equal(recordsSpend("stamp_legacy"), false);
  for (const model of ["spend_threshold", "tiers", "points"]) assert.equal(recordsSpend(model), true);
});

test("unknown or missing models fall back to stamps", () => {
  assert.equal(programmeIdFor("something_new"), "stamps");
  assert.equal(programmeIdFor(undefined), "stamps");
});

test("tierStanding: before the first level", () => {
  const s = tierStanding(ladder, 10000);
  assert.equal(s.current, null);
  assert.equal(s.next.name, "Silver");
  assert.equal(s.toNextPence, 15000);
  assert.equal(s.fraction, 0.4);
  assert.equal(s.label, "£150.00 to Silver");
});

test("tierStanding: sorts the ladder, picks the right level and the progress to the next", () => {
  const s = tierStanding(ladder, 30000);
  assert.equal(s.current.name, "Silver");
  assert.equal(s.next.name, "Gold");
  assert.equal(s.toNextPence, 20000);
  assert.equal(s.fraction, 0.2);
  assert.equal(s.label, "Silver · £200.00 to Gold");
  assert.equal(tierStanding(ladder, 25000).current.name, "Silver");
  assert.equal(tierStanding(ladder, 50000).current.name, "Gold");
});

test("tierStanding: top level, empty ladder and negative spend", () => {
  const top = tierStanding(ladder, 250000);
  assert.equal(top.current.name, "Platinum");
  assert.equal(top.next, null);
  assert.equal(top.toNextPence, null);
  assert.equal(top.fraction, 1);
  assert.equal(top.label, "Platinum · top level");
  assert.equal(tierStanding([], 5000).label, "No levels set up yet");
  assert.equal(tierStanding(ladder, -500).spendPence, 0);
});

test("tierStanding uses the shop's own money formatter", () => {
  const rupees = (pence) => `Rs ${Math.round(pence / 100)}`;
  assert.equal(tierStanding(ladder, 10000, rupees).label, "Rs 150 to Silver");
});

test("points per pound follows the database rule: default 1, clamped to 0..1000", () => {
  assert.equal(pointsPerPound({}), 1);
  assert.equal(pointsPerPound({ loyalty_config: { points_per_pound: 2 } }), 2);
  assert.equal(pointsPerPound({ loyalty_config: { points_per_pound: -4 } }), 0);
  assert.equal(pointsPerPound({ loyalty_config: { points_per_pound: 99999 } }), 1000);
  assert.equal(pointsPerPound({ loyalty_config: { points_per_pound: Number.NaN } }), 1);
});

test("pointsEarned matches the database: floor(pence x rate / 100)", () => {
  assert.equal(pointsEarned({ loyalty_config: { points_per_pound: 2 } }, 3000), 60);
  assert.equal(pointsEarned({}, 199), 1);
  assert.equal(pointsEarned({}, 99), 0);
  assert.equal(pointsEarned({ loyalty_config: { points_per_pound: 1.5 } }, 1000), 15);
  assert.equal(pointsEarned({}, -500), 0);
});

test("pointsStanding: what they can swap now and what is next", () => {
  const rewards = [
    { id: "c", title: "Free cake", points_cost: 500 },
    { id: "a", title: "Free coffee", points_cost: 100 },
    { id: "b", title: "Free lunch", points_cost: 250 },
  ];
  const s = pointsStanding({}, 260, rewards);
  assert.deepEqual(s.affordable.map((r) => r.id), ["a", "b"]);
  assert.equal(s.next.id, "c");
  assert.equal(s.toNext, 240);
  assert.equal(s.fraction, 0.52);
  assert.equal(s.label, "260 points · 240 to Free cake");
  const rich = pointsStanding({}, 900, rewards);
  assert.equal(rich.next, null);
  assert.equal(rich.fraction, 1);
  assert.equal(rich.label, "900 points · rewards ready");
  const none = pointsStanding({}, 0, rewards);
  assert.equal(none.affordable.length, 0);
  assert.equal(none.label, "0 points · 100 to Free coffee");
  assert.equal(pointsStanding({}, 1, []).label, "1 point");
});
