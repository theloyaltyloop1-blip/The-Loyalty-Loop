import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CardLinkError,
  claimCards,
  cardSession,
  deleteAllFidelCardsForUser,
  fidelConfig,
  sweepPendingDeletes,
  unlinkCard,
} from "./fidel-cards.ts";

// All keys, ids and cards below are synthetic. Nothing calls the real Fidel API.
const API_KEY = "sk_test_synthetic-api-key-000";
const SDK_KEY = "pk_test_synthetic-sdk-key-000";
const PROGRAM = "program-synthetic";
const META = "0123456789abcdef0123456789abcdef";
const USER = "11111111-1111-4111-8111-111111111111";
const LINKED = "22222222-2222-4222-8222-222222222222";

const baseEnv = {
  FIDEL_API_KEY: API_KEY,
  FIDEL_SDK_KEY: SDK_KEY,
  FIDEL_PROGRAM_ID: PROGRAM,
  FIDEL_CARD_LINKING_ENABLED: "true",
};
const envOf = (overrides = {}) => {
  const values = { ...baseEnv, ...overrides };
  return (name) => values[name];
};

function fidelCard(overrides = {}) {
  return {
    id: "fidel-card-1",
    accountId: "acct-1",
    programId: PROGRAM,
    scheme: "visa",
    lastNumbers: "4242",
    live: false,
    metadata: { id: META },
    ...overrides,
  };
}

// A fake Fidel: pages of cards for the list call, a status per deleted card.
function fakeFidel({ pages = [[fidelCard()]], deleteStatus = {}, listStatus = 200 } = {}) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    calls.push({ url, method: init.method ?? "GET", key: init.headers?.["Fidel-Key"] });
    if ((init.method ?? "GET") === "DELETE") {
      const id = decodeURIComponent(url.split("/cards/")[1]);
      const status = deleteStatus[id] ?? 204;
      return new Response(status === 204 ? null : "{}", { status });
    }
    if (listStatus !== 200) return new Response("{}", { status: listStatus });
    const start = new URL(url).searchParams.get("start");
    const index = start ? JSON.parse(start).page : 0;
    const items = pages[index] ?? [];
    const last = index + 1 < pages.length ? { page: index + 1 } : undefined;
    return new Response(JSON.stringify({ items, count: items.length, ...(last ? { last } : {}) }), { status: 200 });
  };
  return { fetch, calls };
}

// A fake database recording RPC calls, with scripted results.
function fakeDb({ cards = [], admin = false, claim = () => ({ status: "claimed", linked_card_id: LINKED }),
  unlink = () => ({ status: "unlinked", fidel_card_id: "fidel-card-1" }), pending = [] } = {}) {
  const rpcCalls = [];
  const db = {
    rpc: async (fn, args) => {
      rpcCalls.push({ fn, args });
      if (fn === "fidel_link_identity") return { data: META, error: null };
      if (fn === "claim_linked_card") return { data: claim(args), error: null };
      if (fn === "unlink_linked_card") return { data: unlink(args), error: null };
      if (fn === "mark_fidel_card_deleted") return { data: null, error: null };
      if (fn === "fidel_cards_pending_delete") return { data: pending, error: null };
      return { data: null, error: { code: "unexpected" } };
    },
    activeCards: async () => cards,
    isAdmin: async () => admin,
  };
  return { db, rpcCalls };
}

// Capture every console line so the test can prove no key is ever logged.
const logged = [];
for (const level of ["log", "info", "warn", "error"]) {
  const original = console[level];
  console[level] = (...args) => { logged.push(args.map(String).join(" ")); void original; };
}

test("config: key prefixes decide the environment and must agree", () => {
  assert.equal(fidelConfig(envOf()).live, false);
  assert.equal(fidelConfig(envOf({ FIDEL_API_KEY: "sk_live_x", FIDEL_SDK_KEY: "pk_live_x" })).live, true);
  assert.equal(fidelConfig(envOf({ FIDEL_API_KEY: "sk_live_x" })), null, "live API key with test SDK key");
  assert.equal(fidelConfig(envOf({ FIDEL_API_KEY: "wrong" })), null);
  assert.equal(fidelConfig(envOf({ FIDEL_PROGRAM_ID: "" })), null);
  assert.equal(fidelConfig(envOf({ FIDEL_CARD_LINKING_ENABLED: "false" })).enabled, false);
  assert.equal(fidelConfig(envOf({ FIDEL_CARD_LINKING_ENABLED: undefined })).enabled, false);
});

test("session: kill switch hides everything except for admin testers", async () => {
  const off = envOf({ FIDEL_CARD_LINKING_ENABLED: "false" });
  assert.deepEqual(await cardSession({ env: off, db: fakeDb().db }, USER), { enabled: false });
  const tester = await cardSession({ env: off, db: fakeDb({ admin: true }).db }, USER);
  assert.equal(tester.enabled, true);
  assert.equal(tester.sdkKey, SDK_KEY);
  assert.deepEqual(await cardSession({ env: envOf({ FIDEL_SDK_KEY: "" }), db: fakeDb({ admin: true }).db }, USER),
    { enabled: false }, "unconfigured never enables");
});

test("session: named testers can link while the kill switch is off; others cannot", async () => {
  const off = { FIDEL_CARD_LINKING_ENABLED: "false", FIDEL_CARD_LINKING_TESTER_IDS: ` other-id , ${USER.toUpperCase()} ` };
  const tester = await cardSession({ env: envOf(off), db: fakeDb().db }, USER);
  assert.equal(tester.enabled, true);
  assert.equal(tester.sdkKey, SDK_KEY);
  assert.deepEqual(await cardSession({ env: envOf(off), db: fakeDb().db }, "33333333-3333-4333-8333-333333333333"), { enabled: false });
  assert.deepEqual(await cardSession({ env: envOf({ FIDEL_CARD_LINKING_ENABLED: "false", FIDEL_CARD_LINKING_TESTER_IDS: "" }), db: fakeDb().db }, USER), { enabled: false });
});

test("session: returns the metadata id and SDK key, but never at the 5-card limit", async () => {
  const { db, rpcCalls } = fakeDb();
  const session = await cardSession({ env: envOf(), db }, USER);
  assert.equal(session.metadataId, META);
  assert.equal(session.programId, PROGRAM);
  assert.equal(session.limit, 5);
  assert.deepEqual(rpcCalls, [{ fn: "fidel_link_identity", args: { _user_id: USER } }]);
  const full = Array.from({ length: 5 }, (_, i) => ({ linkedCardId: `c${i}`, scheme: "visa", lastNumbers: "4242", linkedAt: "" }));
  const atLimit = await cardSession({ env: envOf(), db: fakeDb({ cards: full }).db }, USER);
  assert.equal(atLimit.atLimit, true);
  assert.equal(atLimit.sdkKey, undefined);
  assert.equal(atLimit.metadataId, undefined);
});

test("claim: a card id not listed under the user's metadata is never stored", async () => {
  const fidel = fakeFidel();
  const { db, rpcCalls } = fakeDb();
  const result = await claimCards({ env: envOf(), db, fetch: fidel.fetch }, USER, { cardId: "someone-elses-card" });
  assert.equal(result.status, "not_found");
  assert.ok(!rpcCalls.some(c => c.fn === "claim_linked_card"));
  assert.ok(fidel.calls[0].url.includes(`/cards/metadata/${META}?`));
  assert.equal(fidel.calls[0].key, API_KEY);
});

test("claim: wrong program, wrong environment or wrong metadata are filtered out", async () => {
  for (const bad of [{ programId: "other-program" }, { live: true }, { metadata: { id: "f".repeat(32) } }, { metadata: undefined }]) {
    const { db, rpcCalls } = fakeDb();
    const fidel = fakeFidel({ pages: [[fidelCard(bad)]] });
    const result = await claimCards({ env: envOf(), db, fetch: fidel.fetch }, USER, { cardId: "fidel-card-1" });
    assert.equal(result.status, "not_found", JSON.stringify(bad));
    assert.ok(!rpcCalls.some(c => c.fn === "claim_linked_card"));
  }
});

test("claim: stores Fidel's own card fields, not the client's, and returns display fields only", async () => {
  const { db, rpcCalls } = fakeDb({ cards: [{ linkedCardId: LINKED, scheme: "amex", lastNumbers: "0005", linkedAt: "t" }] });
  const fidel = fakeFidel({ pages: [[fidelCard({ scheme: "AMERICANEXPRESS", lastNumbers: "0005" })]] });
  const result = await claimCards({ env: envOf(), db, fetch: fidel.fetch }, USER,
    { cardId: "fidel-card-1", scheme: "visa", lastNumbers: "9999" });
  assert.equal(result.status, "claimed");
  const claim = rpcCalls.find(c => c.fn === "claim_linked_card");
  assert.deepEqual(claim.args, {
    _user_id: USER, _fidel_card_id: "fidel-card-1", _fidel_account_id: "acct-1",
    _card_scheme: "amex", _last_numbers: "0005",
  });
  assert.ok(!JSON.stringify(result).includes("fidel-card-1"), "Fidel card id never returned to the app");
  assert.ok(!JSON.stringify(result).includes("acct-1"));
});

test("claim: over the limit, the card is deleted at Fidel", async () => {
  const fidel = fakeFidel();
  const { db } = fakeDb({ claim: () => ({ status: "limit_reached" }) });
  const result = await claimCards({ env: envOf(), db, fetch: fidel.fetch }, USER, { cardId: "fidel-card-1" });
  assert.equal(result.status, "limit_reached");
  const del = fidel.calls.find(c => c.method === "DELETE");
  assert.ok(del && del.url.endsWith("/v1/cards/fidel-card-1"));
});

test("claim: a card already active on another account is reported, not deleted", async () => {
  const fidel = fakeFidel();
  const { db } = fakeDb({ claim: () => ({ status: "already_linked_elsewhere" }) });
  const result = await claimCards({ env: envOf(), db, fetch: fidel.fetch }, USER, { cardId: "fidel-card-1" });
  assert.equal(result.status, "already_linked_elsewhere");
  assert.ok(!fidel.calls.some(c => c.method === "DELETE"));
});

test("claim: recovery with no card id claims every listed card across pages", async () => {
  const fidel = fakeFidel({ pages: [[fidelCard({ id: "p1" })], [fidelCard({ id: "p2" })]] });
  const { db, rpcCalls } = fakeDb();
  const result = await claimCards({ env: envOf(), db, fetch: fidel.fetch }, USER, {});
  assert.equal(result.status, "claimed");
  assert.deepEqual(rpcCalls.filter(c => c.fn === "claim_linked_card").map(c => c.args._fidel_card_id), ["p1", "p2"]);
  const empty = await claimCards({ env: envOf(), db: fakeDb().db, fetch: fakeFidel({ pages: [[]] }).fetch }, USER, {});
  assert.equal(empty.status, "nothing_to_claim");
});

test("claim: rejects bad input, missing configuration and Fidel failures", async () => {
  await assert.rejects(claimCards({ env: envOf(), db: fakeDb().db, fetch: fakeFidel().fetch }, USER, { cardId: 42 }),
    e => e instanceof CardLinkError && e.status === 400);
  await assert.rejects(claimCards({ env: envOf({ FIDEL_API_KEY: "" }), db: fakeDb().db, fetch: fakeFidel().fetch }, USER, {}),
    e => e instanceof CardLinkError && e.status === 503);
  await assert.rejects(claimCards({ env: envOf(), db: fakeDb().db, fetch: fakeFidel({ listStatus: 500 }).fetch }, USER, {}),
    e => e instanceof CardLinkError && e.status === 502);
});

test("unlink: stops earning first, then deletes at Fidel and records the outcome", async () => {
  const fidel = fakeFidel();
  const { db, rpcCalls } = fakeDb();
  const result = await unlinkCard({ env: envOf(), db, fetch: fidel.fetch }, USER, { linkedCardId: LINKED });
  assert.equal(result.status, "removed");
  assert.deepEqual(rpcCalls.map(c => c.fn), ["unlink_linked_card", "mark_fidel_card_deleted"]);
  assert.deepEqual(rpcCalls[0].args, { _user_id: USER, _linked_card_id: LINKED, _reason: "user" });
  assert.equal(rpcCalls[1].args._error, null);
  assert.ok(fidel.calls.some(c => c.method === "DELETE" && c.url.endsWith("/cards/fidel-card-1")));
});

test("unlink: a Fidel failure is recorded for the sweep, a Fidel 404 counts as deleted", async () => {
  const failing = fakeDb();
  await unlinkCard({ env: envOf(), db: failing.db, fetch: fakeFidel({ deleteStatus: { "fidel-card-1": 503 } }).fetch }, USER, { linkedCardId: LINKED });
  assert.equal(failing.rpcCalls[1].args._error, "fidel_delete_503");
  const gone = fakeDb();
  await unlinkCard({ env: envOf(), db: gone.db, fetch: fakeFidel({ deleteStatus: { "fidel-card-1": 404 } }).fetch }, USER, { linkedCardId: LINKED });
  assert.equal(gone.rpcCalls[1].args._error, null);
});

test("unlink: someone else's card or a bad id is refused without calling Fidel", async () => {
  const fidel = fakeFidel();
  await assert.rejects(unlinkCard({ env: envOf(), db: fakeDb({ unlink: () => ({ status: "not_found" }) }).db, fetch: fidel.fetch },
    USER, { linkedCardId: LINKED }), e => e.status === 404);
  await assert.rejects(unlinkCard({ env: envOf(), db: fakeDb().db, fetch: fidel.fetch }, USER, { linkedCardId: "x" }),
    e => e.status === 400);
  assert.equal(fidel.calls.length, 0);
});

test("sweep: retries pending deletes and alerts on cards stuck over 24 hours", async () => {
  const now = Date.parse("2026-09-24T12:00:00Z");
  const pending = [
    { linked_card_id: "a", fidel_card_id: "ok-card", unlinked_at: "2026-09-24T11:00:00Z" },
    { linked_card_id: "b", fidel_card_id: "bad-card", unlinked_at: "2026-09-24T11:00:00Z" },
    { linked_card_id: "c", fidel_card_id: "bad-card-old", unlinked_at: "2026-09-23T10:00:00Z" },
  ];
  const { db, rpcCalls } = fakeDb({ pending });
  const fidel = fakeFidel({ deleteStatus: { "bad-card": 500, "bad-card-old": 500 } });
  const before = logged.length;
  const result = await sweepPendingDeletes({ env: envOf(), db, fetch: fidel.fetch }, now);
  assert.deepEqual(result, { checked: 3, deleted: 1, failed: 2, overdue: 1 });
  assert.equal(rpcCalls.filter(c => c.fn === "mark_fidel_card_deleted").length, 3);
  assert.ok(logged.slice(before).some(line => line.includes("ALERT")));
});

test("account deletion: all cards must be gone at Fidel before the account is deleted", async () => {
  assert.equal(await deleteAllFidelCardsForUser({ env: envOf({ FIDEL_API_KEY: "" }), fetch: fakeFidel().fetch },
    [{ fidel_card_id: "x", fidel_deleted_at: "2026-09-01" }]), true, "nothing pending needs no Fidel access");
  assert.equal(await deleteAllFidelCardsForUser({ env: envOf({ FIDEL_API_KEY: "" }), fetch: fakeFidel().fetch },
    [{ fidel_card_id: "x", fidel_deleted_at: null }]), false, "pending cards but no configuration: stop");
  assert.equal(await deleteAllFidelCardsForUser({ env: envOf(), fetch: fakeFidel({ deleteStatus: { y: 500 } }).fetch },
    [{ fidel_card_id: "x", fidel_deleted_at: null }, { fidel_card_id: "y", fidel_deleted_at: null }]), false);
  assert.equal(await deleteAllFidelCardsForUser({ env: envOf(), fetch: fakeFidel().fetch },
    [{ fidel_card_id: "x", fidel_deleted_at: null }]), true);
});

test("no Fidel key ever appears in logs", () => {
  for (const line of logged) {
    assert.ok(!line.includes(API_KEY) && !line.includes(SDK_KEY), line);
  }
});
