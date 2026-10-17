import assert from "node:assert/strict";
import test from "node:test";
import { chargeAfterDiscount, parsePounds, rewardDiscountPence } from "./reward-discount.ts";

test("parsePounds reads typed amounts", () => {
  assert.equal(parsePounds("20"), 2000);
  assert.equal(parsePounds("£12.50"), 1250);
  assert.equal(parsePounds(" 1,200 "), 120000);
  assert.equal(parsePounds("12.345"), null);
  assert.equal(parsePounds("abc"), null);
  assert.equal(parsePounds(""), null);
});

test("chargeAfterDiscount never goes below zero", () => {
  assert.equal(chargeAfterDiscount(2000, 500), 1500);
  assert.equal(chargeAfterDiscount(300, 500), 0);
});

test("rewardDiscountPence handles object, array and missing catalog", () => {
  assert.equal(rewardDiscountPence({ catalog: { discount_pence: 500 } }), 500);
  assert.equal(rewardDiscountPence({ catalog: [{ discount_pence: 250 }] }), 250);
  assert.equal(rewardDiscountPence({ catalog: null }), null);
  assert.equal(rewardDiscountPence({ catalog: { discount_pence: null } }), null);
  assert.equal(rewardDiscountPence({}), null);
});
