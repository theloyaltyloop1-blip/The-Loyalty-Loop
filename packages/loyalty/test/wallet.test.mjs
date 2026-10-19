import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { standingFromSnapshot, walletStanding } from "../src/index.ts";

const fixtures = JSON.parse(readFileSync(new URL("./wallet-fixtures.json", import.meta.url), "utf8"));

for (const fixture of fixtures) {
  test(`wallet: ${fixture.name}`, () => {
    assert.deepEqual(walletStanding(fixture.programme, fixture.input), fixture.expected);
  });
}

test("wallet: stamps and spend are not handled here", () => {
  // The caller keeps its own lines for these shops; the type only accepts tiers and points.
  assert.equal(walletStanding("tiers", { tiers: [] }).programName, "Membership Card");
});

test("snapshot: tiers reads the RPC keys and drops blank perks", () => {
  const standing = standingFromSnapshot({
    programme: "tiers",
    tierName: "Gold",
    tierPerks: ["Priority booking", "  "],
    rollingSpendPence: 52050,
    nextTierName: "Platinum",
    toNextTierPence: 47950,
  });
  assert.deepEqual(standing, {
    kind: "tiers",
    tierName: "Gold",
    perks: ["Priority booking"],
    rollingSpendPence: 52050,
    nextTierName: "Platinum",
    toNextPence: 47950,
    label: "£479.50 to Platinum",
  });
});

test("snapshot: top tier and first-level cases", () => {
  const top = standingFromSnapshot({ programme: "tiers", tierName: "Platinum", tierPerks: null, rollingSpendPence: 150000, nextTierName: null, toNextTierPence: null });
  assert.equal(top.label, "Top level");
  assert.deepEqual(top.perks, []);
  const none = standingFromSnapshot({ programme: "tiers", tierName: null, rollingSpendPence: 0, nextTierName: "Silver", toNextTierPence: 25000 });
  assert.equal(none.tierName, null);
  assert.equal(none.label, "£250.00 to Silver");
});

test("snapshot: points balance and rate, singular and plural", () => {
  assert.equal(standingFromSnapshot({ programme: "points", pointsBalance: 1, pointsPerPound: 2 }).label, "1 point · earns 2 points per £1");
  assert.equal(standingFromSnapshot({ programme: "points", pointsBalance: 240 }).label, "240 points · earns 1 point per £1");
  assert.equal(standingFromSnapshot({ programme: "points", pointsBalance: -5 }).balance, 0);
});

test("snapshot: stamps, spend and missing data return null", () => {
  assert.equal(standingFromSnapshot({ programme: "stamps" }), null);
  assert.equal(standingFromSnapshot({ programme: "spend" }), null);
  assert.equal(standingFromSnapshot(null), null);
  assert.equal(standingFromSnapshot(undefined), null);
});
