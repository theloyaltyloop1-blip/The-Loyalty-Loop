import assert from "node:assert/strict";
import { test } from "node:test";
import { walletProgress } from "./wallet-progress.ts";

const spendShop = { reward_model: "spend_threshold", reward_threshold_pence: 5000 };
const tiers = [
  { title: "Free cake", spend_threshold_pence: 5000 },
  { title: "Free coffee", spend_threshold_pence: 2000 },
];

test("spend shops show £ towards the next tier", () => {
  const p = walletProgress(spendShop, { reward_progress_pence: 1250 }, tiers, "Cafe");
  assert.equal(p.label, "Spent");
  assert.equal(p.value, "£12.50");
  assert.equal(p.goal, "Spend £7.50 more for Free coffee");
  const later = walletProgress(spendShop, { reward_progress_pence: 2400 }, tiers, "Cafe");
  assert.equal(later.goal, "Spend £26 more for Free cake");
});

test("negative progress shows £0 and no tiers falls back to the shop threshold", () => {
  const p = walletProgress(spendShop, { reward_progress_pence: -300 }, [], "Cafe");
  assert.equal(p.value, "£0");
  assert.equal(p.goal, "Spend £50 more for your next reward");
});

test("stamp shops keep the old count", () => {
  const p = walletProgress({ loyalty_type: "stamp_card", loyalty_config: { stamps_required: 8 } }, { stamp_count: 3 }, [], "Cafe");
  assert.deepEqual([p.label, p.value, p.goal], ["Stamps", "3", "8 stamps to unlock your reward"]);
});
