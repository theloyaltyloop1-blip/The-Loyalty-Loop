import assert from "node:assert/strict";
import { test } from "node:test";
import { PROGRAMMES, programmeIdFor, progressFor, recordsSpend, rewardWords } from "../src/index.ts";

// ---- The two implementations this package replaces, kept here verbatim as the
// reference the shared function must agree with for every existing shop type.
const legacyPounds = (value) => `£${(value / 100).toFixed(2)}`;

function legacyShopper(shop, member, catalog, money = legacyPounds) {
  const spend = shop.reward_model === "spend_threshold";
  const unit = shop.loyalty_type === "points" ? "points" : shop.loyalty_type === "tiered" ? "visits" : "stamps";
  const value = Math.max(0, spend ? member?.reward_progress_pence ?? 0 : shop.loyalty_type === "points" ? member?.points_balance ?? 0 : member?.stamp_count ?? 0);
  const tiers = catalog.filter((t) => t.business_id === shop.id && (spend ? t.spend_threshold_pence ?? 0 : t.stamp_threshold) > 0)
    .slice().sort((a, b) => (spend ? a.spend_threshold_pence - b.spend_threshold_pence : a.stamp_threshold - b.stamp_threshold));
  const tier = tiers.find((t) => (spend ? t.spend_threshold_pence : t.stamp_threshold) > value) ?? tiers[tiers.length - 1];
  const configured = spend ? shop.reward_threshold_pence : shop.loyalty_config?.stamps_required;
  const threshold = tier ? (spend ? tier.spend_threshold_pence : tier.stamp_threshold) : configured && configured > 0 ? configured : null;
  return {
    value, threshold, unit, spend, title: tier?.title ?? null,
    label: threshold && value <= threshold ? `${spend ? money(value) : value} of ${spend ? money(threshold) : `${threshold} ${unit}`}` : `${spend ? money(value) : `${value} ${unit}`} collected`,
    offer: tier ? (spend ? `Spend ${money(threshold)} · ${tier.title}` : `${threshold} ${unit} · ${tier.title}`) : "Explore this shop’s rewards",
    fraction: threshold ? Math.min(1, value / threshold) : 0,
  };
}

function legacyWeb(business, membership, catalog) {
  const spend = business.reward_model === "spend_threshold";
  const unit = rewardWords(business.loyalty_type).units;
  const value = Math.max(0, spend
    ? membership?.reward_progress_pence ?? 0
    : business.loyalty_type === "points" ? membership?.points_balance ?? 0 : membership?.stamp_count ?? 0);
  const tiers = catalog
    .filter((reward) => reward.business_id === business.id && (spend ? reward.spend_threshold_pence : reward.stamp_threshold) != null && (spend ? reward.spend_threshold_pence : reward.stamp_threshold) > 0)
    .slice()
    .sort((a, b) => spend ? (a.spend_threshold_pence ?? 0) - (b.spend_threshold_pence ?? 0) : a.stamp_threshold - b.stamp_threshold);
  const tier = tiers.find((reward) => (spend ? reward.spend_threshold_pence : reward.stamp_threshold) > value) ?? tiers[tiers.length - 1];
  const configured = spend ? business.reward_threshold_pence : business.loyalty_config?.stamps_required;
  const target = tier ? spend ? tier.spend_threshold_pence : tier.stamp_threshold : configured && configured > 0 ? configured : null;
  const amount = (count) => spend ? legacyPounds(count) : `${count}`;
  return {
    spend, unit, value, target, title: tier?.title ?? null,
    label: target && value <= target ? `${amount(value)} of ${spend ? legacyPounds(target) : `${target} ${unit}`}` : `${spend ? legacyPounds(value) : `${value} ${unit}`} collected`,
    reward: tier?.title ?? "Loyalty card",
    fraction: target ? Math.min(1, value / target) : 0,
  };
}

// ---- The grid: every existing shop type, with and without a catalogue and member.
const ID = "shop-1";
const businesses = [
  { id: ID, reward_model: "stamp_legacy", loyalty_type: "stamp_card", loyalty_config: { stamps_required: 8 } },
  { id: ID, reward_model: "stamp_legacy", loyalty_type: "stamp_card", loyalty_config: null },
  { id: ID, reward_model: "stamp_legacy", loyalty_type: "points", loyalty_config: { stamps_required: 100 } },
  { id: ID, reward_model: "stamp_legacy", loyalty_type: "tiered", loyalty_config: { stamps_required: 5 } },
  { id: ID, reward_model: "spend_threshold", loyalty_type: "stamp_card", reward_threshold_pence: 5000 },
  { id: ID, reward_model: "spend_threshold", loyalty_type: "stamp_card", reward_threshold_pence: null },
  { id: ID, loyalty_type: "stamp_card" },
];
const members = [
  undefined, null, {},
  { stamp_count: 0, points_balance: 0, reward_progress_pence: 0 },
  { stamp_count: 3, points_balance: 40, reward_progress_pence: 1250 },
  { stamp_count: 10, points_balance: 100, reward_progress_pence: 5000 },
  { stamp_count: 14, points_balance: 250, reward_progress_pence: 9000 },
  { stamp_count: 2, points_balance: 5, reward_progress_pence: -300 },
];
const catalogs = [
  [],
  [{ business_id: ID, title: "Free coffee", stamp_threshold: 8, spend_threshold_pence: null }],
  [
    { business_id: ID, title: "Gold", stamp_threshold: 20, spend_threshold_pence: 10000 },
    { business_id: ID, title: "Silver", stamp_threshold: 10, spend_threshold_pence: 5000 },
    { business_id: ID, title: "Bronze", stamp_threshold: 5, spend_threshold_pence: 2000 },
  ],
  [
    { business_id: "other-shop", title: "Not mine", stamp_threshold: 3, spend_threshold_pence: 1000 },
    { business_id: ID, title: "No spend amount", stamp_threshold: 6, spend_threshold_pence: null },
  ],
];

test("progressFor matches the old shopper-app function on every existing shop type", () => {
  let cases = 0;
  for (const business of businesses) {
    for (const member of members) {
      for (const catalog of catalogs) {
        const old = legacyShopper(business, member, catalog);
        const now = progressFor(business, member, catalog);
        for (const key of Object.keys(old)) {
          assert.deepEqual(now[key], old[key], `${key} differs for ${JSON.stringify({ business, member, catalog })}`);
        }
        cases += 1;
      }
    }
  }
  assert.equal(cases, 7 * 8 * 4);
});

test("progressFor matches the old website function on every existing shop type", () => {
  for (const business of businesses) {
    for (const member of members) {
      for (const catalog of catalogs) {
        const old = legacyWeb(business, member, catalog);
        const now = progressFor(business, member, catalog);
        assert.equal(now.spend, old.spend);
        assert.equal(now.unit, old.unit);
        assert.equal(now.value, old.value);
        assert.equal(now.threshold, old.target);
        assert.equal(now.title, old.title);
        assert.equal(now.label, old.label);
        assert.equal(now.reward, old.reward);
        assert.equal(now.fraction, old.fraction);
      }
    }
  }
});

test("a shop's own money formatter is used for spend shops", () => {
  const rupees = (pence) => `Rs ${Math.round(pence / 100)}`;
  const business = { id: ID, reward_model: "spend_threshold", reward_threshold_pence: 500000 };
  const catalog = [{ business_id: ID, title: "Free trim", stamp_threshold: 10, spend_threshold_pence: 500000 }];
  const result = progressFor(business, { reward_progress_pence: 120000 }, catalog, rupees);
  assert.equal(result.label, "Rs 1200 of Rs 5000");
  assert.equal(result.offer, "Spend Rs 5000 · Free trim");
});

test("never invents a reward when the catalogue is empty and nothing is configured", () => {
  const result = progressFor({ id: ID, reward_model: "spend_threshold" }, { reward_progress_pence: 700 }, []);
  assert.equal(result.threshold, null);
  assert.equal(result.fraction, 0);
  assert.equal(result.offer, "Explore this shop’s rewards");
  assert.equal(result.label, "£7.00 collected");
});

test("programme registry: every programme resolves from its own model", () => {
  for (const programme of Object.values(PROGRAMMES)) {
    assert.equal(programmeIdFor(programme.model), programme.id);
    assert.equal(programmeIdFor({ reward_model: programme.model }), programme.id);
    assert.equal(recordsSpend(programme.model), programme.recordsSpend);
  }
});

test("legacy stamp, points and visit shops are all the stamps programme; missing model defaults to stamps", () => {
  assert.equal(programmeIdFor({ reward_model: "stamp_legacy", loyalty_type: "points" }), "stamps");
  assert.equal(programmeIdFor({ reward_model: "stamp_legacy", loyalty_type: "tiered" }), "stamps");
  assert.equal(programmeIdFor(null), "stamps");
  assert.equal(programmeIdFor(undefined), "stamps");
  assert.equal(programmeIdFor({}), "stamps");
  assert.equal(recordsSpend(null), false);
  assert.equal(recordsSpend({ reward_model: "spend_threshold" }), true);
});

test("rewardWords keeps the wording the website already shows", () => {
  assert.equal(rewardWords("stamp_card").units, "stamps");
  assert.equal(rewardWords("points").thresholdLabel, "Points needed for a reward");
  assert.equal(rewardWords("tiered").remaining(1), "1 more visit to reach the next level");
  assert.equal(rewardWords("tiered").remaining(3), "3 more visits to reach the next level");
  assert.equal(rewardWords(undefined).programme, "Stamp card");
  assert.equal(rewardWords(null).remaining(2), "2 more stamps until a reward");
});
