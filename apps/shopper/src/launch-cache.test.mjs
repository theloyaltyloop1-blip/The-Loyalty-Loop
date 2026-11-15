import assert from "node:assert/strict";
import test from "node:test";
import { createLaunchCache, isSessionRejection, MAX_AGE_MS, stripSecrets } from "./launch-cache-core.ts";

const memory = () => {
  const map = new Map();
  return { map, kv: { get: (k) => map.get(k) ?? null, set: (k, v) => void map.set(k, v), remove: (k) => void map.delete(k) } };
};

test("round trip for the same user only", () => {
  const { kv } = memory();
  const c = createLaunchCache(kv);
  assert.equal(c.write("home", "u1", { a: 1 }, c.ticket()), true);
  assert.deepEqual(c.read("home", "u1").data, { a: 1 });
  assert.equal(c.read("home", "u2"), null);
});

test("first install: empty cache reads as null", () => {
  const c = createLaunchCache(memory().kv);
  assert.equal(c.read("home", "u1"), null);
});

test("entries expire after 7 days", () => {
  let t = 1_000_000;
  const c = createLaunchCache(memory().kv, () => t);
  c.write("home", "u1", [1], c.ticket());
  t += MAX_AGE_MS - 1;
  assert.notEqual(c.read("home", "u1"), null);
  t += 2;
  assert.equal(c.read("home", "u1"), null);
});

test("a clock set far backwards does not keep an entry alive", () => {
  let t = 10 * MAX_AGE_MS;
  const c = createLaunchCache(memory().kv, () => t);
  c.write("home", "u1", [1], c.ticket());
  t = 0;
  assert.equal(c.read("home", "u1"), null);
});

test("clear wipes every user and scope", () => {
  const { kv, map } = memory();
  const c = createLaunchCache(kv);
  c.write("shops", "u1", [1], c.ticket());
  c.write("stats", "u1", [2], c.ticket());
  c.write("shops", "u2", [3], c.ticket());
  c.clear();
  assert.equal(map.size, 0);
  assert.equal(c.read("shops", "u1"), null);
});

test("a write started before sign-out cannot re-create the cache", () => {
  const { kv, map } = memory();
  const c = createLaunchCache(kv);
  const ticket = c.ticket(); // fetch starts
  c.clear(); // user signs out while it is in flight
  assert.equal(c.write("home", "u1", { late: true }, ticket), false);
  assert.equal(map.size, 0);
  assert.equal(c.write("home", "u1", { ok: 1 }, c.ticket()), true); // a new session works
});

test("corrupt or foreign entries read as null", () => {
  const { kv, map } = memory();
  const c = createLaunchCache(kv);
  map.set("launch-cache.v1.home.u1", "{not json");
  assert.equal(c.read("home", "u1"), null);
  map.set("launch-cache.v1.home.u1", JSON.stringify({ userId: "someone-else", savedAt: Date.now(), data: 1 }));
  assert.equal(c.read("home", "u1"), null);
});

test("storage that throws never breaks the caller", () => {
  const boom = () => { throw new Error("disk full"); };
  const c = createLaunchCache({ get: boom, set: boom, remove: boom });
  assert.equal(c.write("home", "u1", 1, c.ticket()), false);
  assert.equal(c.read("home", "u1"), null);
  assert.doesNotThrow(() => c.clear());
});

test("secret-looking keys are stripped, deeply, on write", () => {
  const { kv, map } = memory();
  const c = createLaunchCache(kv);
  c.write("shops", "u1", [{ id: "s1", name: "Cafe", sumup_access_token: "x", nested: { API_KEY: "k", iban: "GB00", ok: 1 }, list: [{ client_secret: "s", fine: true }], password_hash: "p", qr_token: "q" }], c.ticket());
  const stored = JSON.stringify([...map.values()]);
  for (const bad of ["sumup_access_token", "API_KEY", "iban", "client_secret", "password_hash", "qr_token"]) assert.equal(stored.includes(bad), false, bad);
  assert.deepEqual(c.read("shops", "u1").data, [{ id: "s1", name: "Cafe", nested: { ok: 1 }, list: [{ fine: true }] }]);
});

test("stripSecrets leaves primitives and does not mutate the input", () => {
  const input = { token: "a", n: 1 };
  assert.deepEqual(stripSecrets(input), { n: 1 });
  assert.equal(input.token, "a");
  assert.equal(stripSecrets(null), null);
  assert.equal(stripSecrets("x"), "x");
});

test("only real rejections sign the user out, never offline errors", () => {
  assert.equal(isSessionRejection({ name: "AuthRetryableFetchError", status: 0 }), false);
  assert.equal(isSessionRejection({ name: "AuthRetryableFetchError", status: 503 }), false);
  assert.equal(isSessionRejection(new TypeError("Network request failed")), false);
  assert.equal(isSessionRejection(null), false);
  assert.equal(isSessionRejection({ status: 500 }), false);
  assert.equal(isSessionRejection({ status: 401 }), true);
  assert.equal(isSessionRejection({ status: 400, code: "refresh_token_not_found" }), true);
  assert.equal(isSessionRejection({ name: "AuthSessionMissingError" }), true);
});
