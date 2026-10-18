import assert from "node:assert/strict";
import test from "node:test";
import { ratingLabel, ratingStats } from "./ratings.ts";

test("averages each shop's stars", () => {
  const stats = ratingStats([
    { business_id: "a", rating: 5 },
    { business_id: "a", rating: 4 },
    { business_id: "b", rating: 3 },
  ]);
  assert.deepEqual(stats.get("a"), { rating_avg: 4.5, rating_count: 2 });
  assert.equal(ratingLabel(stats.get("a")), "★ 4.5 (2)");
  assert.equal(ratingLabel(stats.get("b")), "★ 3.0 (1)");
});

test("shops without reviews show nothing", () => {
  assert.equal(ratingLabel({}), null);
  assert.equal(ratingLabel({ rating_avg: 0, rating_count: 0 }), null);
});
