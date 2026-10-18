import assert from "node:assert/strict";
import test from "node:test";
import { featureBadge, hasAllFeatures } from "./shop-features.ts";

test("halal badge shows the shop's claim or the certifier", () => {
  assert.equal(featureBadge("halal"), "Halal (as stated by the shop)");
  assert.equal(featureBadge("halal", "HMC"), "Halal (certified by HMC)");
  assert.equal(featureBadge("vegan"), "Vegan options");
});

test("filter needs every selected feature", () => {
  assert.equal(hasAllFeatures(["halal", "vegan"], ["halal"]), true);
  assert.equal(hasAllFeatures(["halal"], ["halal", "vegan"]), false);
  assert.equal(hasAllFeatures(null, []), true);
  assert.equal(hasAllFeatures(undefined, ["halal"]), false);
});
