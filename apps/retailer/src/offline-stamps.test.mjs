import assert from "node:assert/strict";
import test from "node:test";
import {
  backoffMs,
  BACKOFF_MAX_MS,
  classify,
  createOfflineStampQueue,
  MAX_AGE_MS,
  MAX_QUEUED,
} from "./offline-stamps-core.ts";

const memory = () => {
  const map = new Map();
  return { map, kv: { get: (k) => map.get(k) ?? null, set: (k, v) => void map.set(k, v), remove: (k) => void map.delete(k) } };
};

let n = 0;
const stamp = (over = {}) => ({
  ref: `ref-${++n}`,
  userId: "cust-1",
  businessId: "shop-1",
  value: 1,
  paymentMethod: null,
  name: "Sam",
  ...over,
});

const OFFLINE = { status: 0, error: { message: "TypeError: Network request failed", code: "" } };
const OK = { status: 201, error: null };

test("classify: offline, timeouts and server trouble are retried", () => {
  assert.equal(classify(OFFLINE), "retry");
  assert.equal(classify({ status: 0, error: { message: "AbortError: Aborted" } }), "retry");
  assert.equal(classify({ status: 503, error: { message: "upstream" } }), "retry");
  assert.equal(classify({ status: 429, error: { message: "slow down" } }), "retry");
  assert.equal(classify({ status: 401, error: { code: "PGRST301", message: "JWT expired" } }), "retry");
});

test("classify: the same stamp already saved counts as sent", () => {
  const dup = { status: 409, error: { code: "23505", message: 'duplicate key value violates unique constraint "transactions_client_ref_key"' } };
  assert.equal(classify(dup), "sent");
  assert.equal(classify(OK), "sent");
});

test("classify: real refusals are not retried", () => {
  assert.equal(classify({ status: 400, error: { code: "P0001", message: "manual_too_soon" } }), "rejected");
  assert.equal(classify({ status: 403, error: { code: "42501", message: "new row violates row-level security policy" } }), "rejected");
  assert.equal(classify({ status: 400, error: { code: "P0001", message: "business is inactive" } }), "rejected");
  // A different unique violation is a refusal, not a duplicate of this stamp.
  assert.equal(classify({ status: 409, error: { code: "23505", message: "duplicate key on something_else" } }), "rejected");
});

test("first install: empty queue", () => {
  const q = createOfflineStampQueue(memory().kv);
  assert.equal(q.count("staff"), 0);
  assert.deepEqual(q.list("staff"), []);
});

test("queue survives a restart (new queue object on the same storage)", () => {
  const { kv } = memory();
  createOfflineStampQueue(kv).add("staff", stamp({ ref: "a" }));
  const again = createOfflineStampQueue(kv);
  assert.equal(again.count("staff"), 1);
  assert.equal(again.list("staff")[0].ref, "a");
});

test("each account has its own queue, and per-shop counts work", () => {
  const q = createOfflineStampQueue(memory().kv);
  q.add("staff-a", stamp());
  q.add("staff-a", stamp({ businessId: "shop-2" }));
  q.add("staff-b", stamp());
  assert.equal(q.count("staff-a"), 2);
  assert.equal(q.count("staff-a", "shop-2"), 1);
  assert.equal(q.count("staff-b"), 1);
});

test("adding the same stamp twice keeps one", () => {
  const q = createOfflineStampQueue(memory().kv);
  const s = stamp();
  q.add("staff", s);
  q.add("staff", s);
  assert.equal(q.count("staff"), 1);
});

test("bad input is refused", () => {
  const q = createOfflineStampQueue(memory().kv);
  assert.deepEqual(q.add("staff", stamp({ value: 0 })), { ok: false, reason: "invalid" });
  assert.deepEqual(q.add("staff", stamp({ userId: "" })), { ok: false, reason: "invalid" });
  assert.deepEqual(q.add("", stamp()), { ok: false, reason: "invalid" });
});

test("count limit", () => {
  const q = createOfflineStampQueue(memory().kv);
  for (let i = 0; i < MAX_QUEUED; i++) assert.equal(q.add("staff", stamp()).ok, true);
  assert.deepEqual(q.add("staff", stamp()), { ok: false, reason: "full" });
  assert.equal(q.count("staff"), MAX_QUEUED);
});

test("corrupt storage reads as empty", () => {
  const { kv, map } = memory();
  map.set("offline-stamps.v1.staff", "{not json");
  const q = createOfflineStampQueue(kv);
  assert.equal(q.count("staff"), 0);
  assert.equal(q.add("staff", stamp()).ok, true);
});

test("drain sends oldest first and empties the queue", async () => {
  let t = 1_000;
  const q = createOfflineStampQueue(memory().kv, () => t);
  q.add("staff", stamp({ ref: "first" }));
  t += 10;
  q.add("staff", stamp({ ref: "second" }));
  const order = [];
  const report = await q.drain("staff", async (item) => { order.push(item.ref); return OK; });
  assert.deepEqual(order, ["first", "second"]);
  assert.equal(report.sent.length, 2);
  assert.equal(q.count("staff"), 0);
});

test("offline: drain stops at the first failure, keeps order, backs off", async () => {
  let t = 1_000;
  const q = createOfflineStampQueue(memory().kv, () => t);
  q.add("staff", stamp({ ref: "a" }));
  q.add("staff", stamp({ ref: "b" }));
  let calls = 0;
  const report = await q.drain("staff", async () => { calls++; return OFFLINE; });
  assert.equal(calls, 1);
  assert.equal(report.stillOffline, true);
  assert.deepEqual(q.list("staff").map((i) => i.ref), ["a", "b"]);
  assert.ok(q.nextAttemptAt("staff") > t);
  // A timed round before the backoff ends does nothing.
  const early = await q.drain("staff", async () => { calls++; return OK; });
  assert.equal(early.skipped, true);
  assert.equal(calls, 1);
  // Coming back to the front / back online forces a round.
  const forced = await q.drain("staff", async () => { calls++; return OK; }, true);
  assert.equal(forced.sent.length, 2);
  assert.equal(q.count("staff"), 0);
});

test("a thrown error while sending counts as offline", async () => {
  const q = createOfflineStampQueue(memory().kv);
  q.add("staff", stamp());
  const report = await q.drain("staff", async () => { throw new Error("socket closed"); });
  assert.equal(report.stillOffline, true);
  assert.equal(q.count("staff"), 1);
});

test("backoff grows and is capped", () => {
  assert.equal(backoffMs(1), 5_000);
  assert.equal(backoffMs(2), 10_000);
  assert.equal(backoffMs(3), 20_000);
  assert.equal(backoffMs(50), BACKOFF_MAX_MS);
});

test("a refused stamp is reported and removed; the rest still send", async () => {
  const q = createOfflineStampQueue(memory().kv, () => 1_000);
  q.add("staff", stamp({ ref: "bad", savedAt: 1 }));
  q.add("staff", stamp({ ref: "good", savedAt: 2 }));
  const report = await q.drain("staff", async (item) =>
    item.ref === "bad" ? { status: 400, error: { code: "P0001", message: "business is inactive" } } : OK, true);
  assert.equal(report.rejected.length, 1);
  assert.equal(report.rejected[0].item.ref, "bad");
  assert.deepEqual(report.sent.map((i) => i.ref), ["good"]);
  assert.equal(q.count("staff"), 0);
});

test("retry after a timeout that actually got through gives one stamp", async () => {
  // Fake server with the same rule as transactions_client_ref_key.
  const saved = new Set();
  const server = async (item) => {
    if (saved.has(item.ref)) return { status: 409, error: { code: "23505", message: 'duplicate key value violates unique constraint "transactions_client_ref_key"' } };
    saved.add(item.ref);
    return OK;
  };
  const q = createOfflineStampQueue(memory().kv);
  q.add("staff", stamp({ ref: "x" }));
  // First try: the server saves it but the answer is lost on the way back.
  await q.drain("staff", async (item) => { await server(item); return OFFLINE; });
  assert.equal(q.count("staff"), 1);
  const report = await q.drain("staff", server, true);
  assert.equal(report.sent.length, 1);
  assert.equal(saved.size, 1);
  assert.equal(q.count("staff"), 0);
});

test("stamps older than the age limit are dropped, not sent", async () => {
  let t = 10 * MAX_AGE_MS;
  const q = createOfflineStampQueue(memory().kv, () => t);
  q.add("staff", stamp({ ref: "old" }));
  t += MAX_AGE_MS - 1;
  q.add("staff", stamp({ ref: "new" }));
  t += 2;
  const sent = [];
  const report = await q.drain("staff", async (item) => { sent.push(item.ref); return OK; }, true);
  assert.deepEqual(report.expired.map((i) => i.ref), ["old"]);
  assert.deepEqual(sent, ["new"]);
});

test("a clock moved far back does not keep a stamp alive", async () => {
  let t = 10 * MAX_AGE_MS;
  const q = createOfflineStampQueue(memory().kv, () => t);
  q.add("staff", stamp());
  t = 0;
  const report = await q.drain("staff", async () => OK, true);
  assert.equal(report.expired.length, 1);
  assert.equal(report.sent.length, 0);
});

test("two rounds at once never send the same stamp twice", async () => {
  const q = createOfflineStampQueue(memory().kv);
  q.add("staff", stamp());
  let calls = 0;
  let release;
  const gate = new Promise((r) => (release = r));
  const first = q.drain("staff", async () => { calls++; await gate; return OK; }, true);
  const second = await q.drain("staff", async () => { calls++; return OK; }, true);
  assert.equal(second.skipped, true);
  release();
  await first;
  assert.equal(calls, 1);
});

test("a stamp added while a round is sending is sent in the same round", async () => {
  const q = createOfflineStampQueue(memory().kv, () => 1_000);
  q.add("staff", stamp({ ref: "a", savedAt: 1 }));
  const sent = [];
  await q.drain("staff", async (item) => {
    if (item.ref === "a") q.add("staff", stamp({ ref: "b", savedAt: 2 }));
    sent.push(item.ref);
    return OK;
  }, true);
  assert.deepEqual(sent, ["a", "b"]);
});

// ---------------------------------------------------------------------------
// The real supabase-js client with an injected fetch, so the answers the app
// actually gets (offline, timeout, duplicate, refusal) are classified right.
// No network is used. Mirrors insertStamp() in offline-stamps.ts.
import { createClient } from "@supabase/supabase-js";

const client = (fetchImpl) =>
  createClient("https://example.supabase.co", "anon-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchImpl },
  });

async function insertVia(fetchImpl, item, timeoutMs = 200) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const { status, error } = await client(fetchImpl)
      .from("transactions")
      .insert({ user_id: item.userId, business_id: item.businessId, type: "stamp", value: item.value, client_ref: item.ref })
      .abortSignal(controller.signal);
    return { status, error: error ? { code: error.code, message: error.message, details: error.details } : null };
  } catch (e) {
    return { status: 0, error: { message: String(e) } };
  } finally {
    clearTimeout(timer);
  }
}

const json = (status, body) => async () => new Response(body === null ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

test("supabase-js: no signal comes back as status 0 and is queued", async () => {
  const result = await insertVia(async () => { throw new TypeError("Network request failed"); }, stamp());
  assert.equal(result.status, 0);
  assert.equal(classify(result), "retry");
});

test("supabase-js: a request that hangs is cut off by the timeout and queued", async () => {
  const hang = (_url, init) => new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))));
  const result = await insertVia(hang, stamp(), 50);
  assert.equal(result.status, 0);
  assert.equal(classify(result), "retry");
});

test("supabase-js: the stamp already saved (duplicate client_ref) counts as sent", async () => {
  const result = await insertVia(json(409, { code: "23505", message: 'duplicate key value violates unique constraint "transactions_client_ref_key"', details: "Key (client_ref)=(x) already exists.", hint: null }), stamp());
  assert.equal(classify(result), "sent");
});

test("supabase-js: a database refusal is reported, not queued", async () => {
  const result = await insertVia(json(400, { code: "P0001", message: "manual_too_soon", details: "2026-11-21T12:00:00Z", hint: null }), stamp());
  assert.equal(result.status, 400);
  assert.equal(classify(result), "rejected");
});

test("supabase-js: a normal insert is sent", async () => {
  const result = await insertVia(json(201, null), stamp());
  assert.equal(result.error, null);
  assert.equal(classify(result), "sent");
});

test("end to end: offline scans wait, then go in once when the signal returns", async () => {
  let online = false;
  const saved = new Set();
  const fakeFetch = async (_url, init) => {
    if (!online) throw new TypeError("Network request failed");
    const body = JSON.parse(init.body);
    if (saved.has(body.client_ref)) {
      return json(409, { code: "23505", message: 'duplicate key value violates unique constraint "transactions_client_ref_key"', details: null, hint: null })();
    }
    saved.add(body.client_ref);
    return json(201, null)();
  };
  const q = createOfflineStampQueue(memory().kv, () => 5_000);
  q.add("staff", stamp({ ref: "c1" }));
  q.add("staff", stamp({ ref: "c2", userId: "cust-2" }));
  const offlineRound = await q.drain("staff", (item) => insertVia(fakeFetch, item), true);
  assert.equal(offlineRound.stillOffline, true);
  assert.equal(q.count("staff"), 2);
  online = true;
  const back = await q.drain("staff", (item) => insertVia(fakeFetch, item), true);
  assert.deepEqual(back.sent.map((i) => i.ref), ["c1", "c2"]);
  assert.equal(saved.size, 2);
  // Sending again (e.g. a copy that slipped through) changes nothing.
  q.add("staff", stamp({ ref: "c1" }));
  await q.drain("staff", (item) => insertVia(fakeFetch, item), true);
  assert.equal(saved.size, 2);
  assert.equal(q.count("staff"), 0);
});
