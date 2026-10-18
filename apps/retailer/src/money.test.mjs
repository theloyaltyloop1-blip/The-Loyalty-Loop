import assert from "node:assert/strict";
import test from "node:test";
import { findCountry, formatMoney, shopMoney } from "./money.ts";

test("UK shops show pounds and pence", () => {
  assert.equal(shopMoney("GB")(450), "£4.50");
  assert.equal(shopMoney(null)(2000), "£20.00");
});

test("Pakistani shops show whole rupees with a space", () => {
  assert.equal(shopMoney("PK")(45000), "Rs 450");
  assert.equal(shopMoney("PK")(250000000), "Rs 2,500,000");
});

test("unknown countries fall back to the UK", () => {
  assert.equal(findCountry([], "ZZ").code, "GB");
  assert.equal(formatMoney(100, findCountry([], "ZZ")), "£1.00");
});
