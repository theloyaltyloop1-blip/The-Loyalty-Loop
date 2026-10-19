import assert from "node:assert/strict";
import { test } from "node:test";
import { SHOP_KINDS, buildShopArgs, onboardingDefaults, parseAmount } from "../src/index.ts";

const gbp = { symbol: "£", scale: 1 };
const pkr = { symbol: "Rs", scale: 300 };

test("shop kinds recommend stamps for everyday shops and tiers for style and premium", () => {
  assert.deepEqual(SHOP_KINDS.map((k) => [k.key, k.programme]), [["everyday", "stamps"], ["style", "tiers"], ["premium", "tiers"]]);
});

test("every default draft is valid for every programme, kind and currency", () => {
  for (const programme of ["stamps", "spend", "tiers", "points"]) {
    for (const kind of SHOP_KINDS) {
      for (const currency of [gbp, pkr]) {
        const result = buildShopArgs(programme, onboardingDefaults(programme, kind.key, currency));
        assert.equal(result.ok, true, `${programme}/${kind.key}/${currency.symbol}: ${result.message}`);
      }
    }
  }
});

test("defaults scale with the currency", () => {
  const tiers = onboardingDefaults("tiers", "style", pkr).tiers;
  assert.deepEqual(tiers.map((t) => t.amount), ["45000", "150000", "360000"]);
  assert.match(onboardingDefaults("points", "style", pkr).rewards[0].title, /^Rs 1,500 off/);
  const args = buildShopArgs("tiers", onboardingDefaults("tiers", "style", gbp)).args;
  assert.deepEqual(args._tiers.map((t) => t.spend_threshold_pence), [15000, 50000, 120000]);
  assert.deepEqual(args._tiers[1].perks, ["Free gift wrapping", "Early access to new arrivals"]);
});

test("stamps args use the smallest reward as the card size; points args carry the rate", () => {
  const d = onboardingDefaults("stamps", "everyday", gbp);
  d.rewards.push({ title: "Free lunch", description: "", amount: "16" });
  assert.equal(buildShopArgs("stamps", d).args._stamps_required, 8);
  const p = onboardingDefaults("points", "style", gbp);
  p.pointsPerPound = "2";
  const args = buildShopArgs("points", p).args;
  assert.equal(args._points_per_pound, 2);
  assert.deepEqual(args._rewards.map((r) => r.points_cost), [100, 300]);
});

test("bad drafts get a plain message", () => {
  const d = onboardingDefaults("spend", "everyday", gbp);
  d.rewards[1].amount = d.rewards[0].amount;
  assert.match(buildShopArgs("spend", d).message, /different amount/);
  d.rewards[1].amount = "abc";
  assert.match(buildShopArgs("spend", d).message, /Free lunch/);
  const s = onboardingDefaults("stamps", "everyday", gbp);
  s.rewards[0].title = "  ";
  assert.match(buildShopArgs("stamps", s).message, /needs a name/);
  s.rewards[0] = { title: "x", description: "", amount: "101" };
  assert.equal(buildShopArgs("stamps", s).ok, false);
  const t = onboardingDefaults("tiers", "style", gbp);
  t.tiers[0].perks = "1,2,3,4,5,6,7";
  assert.match(buildShopArgs("tiers", t).message, /6 perks/);
  assert.equal(parseAmount("Rs 2,000"), 2000);
  assert.equal(parseAmount("£12.5"), 12.5);
  assert.equal(parseAmount("-3"), null);
});
