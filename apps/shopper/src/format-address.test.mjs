import assert from "node:assert/strict";
import test from "node:test";
import { formatAddress } from "./format-address.ts";

test("title-cases street words and capitalises postcodes", () => {
  assert.equal(formatAddress("9 drakefield road"), "9 Drakefield Road");
  assert.equal(formatAddress("12 HIGH STREET, london sw17 8rr"), "12 High Street, London SW17 8RR");
  assert.equal(formatAddress("flat 2, st john's way"), "Flat 2, St John's Way");
  assert.equal(formatAddress("10 lane of the oaks"), "10 Lane of the Oaks");
  assert.equal(formatAddress("ec1a1bb"), "EC1A 1BB");
  assert.equal(formatAddress(null), "");
});
