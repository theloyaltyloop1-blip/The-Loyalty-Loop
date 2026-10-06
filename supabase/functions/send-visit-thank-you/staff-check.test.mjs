import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { canSendVisitThankYou } from "../_shared/visit-thank-you-auth.ts";

// In-memory stand-in for the Supabase query builder: applies .eq() filters to
// rows shaped like the real staff_members table (status, not is_active).
function mockAdmin(rows, failWith) {
  return {
    from(table) {
      assert.equal(table, "staff_members");
      const filters = [];
      const q = {
        select: () => q,
        eq: (col, val) => (filters.push([col, val]), q),
        maybeSingle: async () => {
          for (const [col] of filters) assert.ok(col in rows[0], `unknown column ${col}`);
          if (failWith) return { data: null, error: failWith };
          const hit = rows.filter((r) => filters.every(([c, v]) => r[c] === v));
          return { data: hit[0] ? { id: hit[0].id } : null, error: null };
        },
      };
      return q;
    },
  };
}

const owner = "u-owner", staff = "u-staff", revoked = "u-revoked", invited = "u-invited", elsewhere = "u-elsewhere", stranger = "u-stranger";
const shop = "shop-1", other = "shop-2";
const rows = [
  { id: 1, business_id: shop, user_id: staff, status: "active" },
  { id: 2, business_id: shop, user_id: revoked, status: "revoked" },
  { id: 3, business_id: shop, user_id: invited, status: "invited" },
  { id: 4, business_id: other, user_id: elsewhere, status: "active" },
];
const can = (uid, db = mockAdmin(rows)) => canSendVisitThankYou(db, uid, shop, owner);

test("owner is authorized without a staff row", async () => {
  assert.equal(await can(owner, mockAdmin([{ id: 0, business_id: "x", user_id: "x", status: "active" }])), true);
});
test("active staff at this shop is authorized", async () => {
  assert.equal(await can(staff), true);
});
test("non-staff, revoked, invited and other-shop staff are rejected", async () => {
  for (const uid of [stranger, revoked, invited, elsewhere]) assert.equal(await can(uid), false, uid);
});
test("a lookup error denies access", async () => {
  const quiet = console.error; console.error = () => {};
  try { assert.equal(await can(staff, mockAdmin(rows, { code: "XX000" })), false); } finally { console.error = quiet; }
});
test("a shop with no owner id does not authorize an undefined user", async () => {
  assert.equal(await canSendVisitThankYou(mockAdmin(rows), undefined, shop, undefined), false);
});

const fn = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
const schema = readFileSync(new URL("../../migrations/20260807120746_staff_accounts.sql", import.meta.url), "utf8");
test("the function uses the shared check and the schema has status, not is_active", () => {
  assert.match(fn, /canSendVisitThankYou\(admin, user\.id, business_id, business\.owner_id\)/);
  assert.doesNotMatch(fn, /is_active/);
  const table = schema.match(/create table public\.staff_members \(([\s\S]*?)\n\);/)[1];
  assert.match(table, /status in \('invited','active','revoked'\)/);
  assert.doesNotMatch(table, /is_active/);
});
