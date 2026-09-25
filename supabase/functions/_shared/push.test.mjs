import assert from "node:assert/strict";
import { test } from "node:test";
import { sendPendingPushes } from "./push.ts";

// Synthetic notifications, tokens and settings; nothing calls the real Expo service.
const USER = "user-1";
const SHOP = "shop-1";

function fakeStore({ pending = [], settings = null, tokens = ["ExponentPushToken[a]"] } = {}) {
  const marks = [];
  let since = null;
  return {
    marks,
    get since() { return since; },
    store: {
      pending: async (_user, _shop, sinceIso) => { since = sinceIso; return pending; },
      settings: async () => settings,
      tokens: async () => tokens,
      mark: async (ids, error, handled = true) => { marks.push({ ids, error, handled }); },
    },
  };
}

function fakeExpo(status = 200, items = null) {
  const calls = [];
  const fetch = async (url, init) => {
    const messages = JSON.parse(init.body);
    calls.push({ url, messages });
    return new Response(JSON.stringify({ data: items ?? messages.map(() => ({ status: "ok" })) }), { status });
  };
  return { fetch, calls };
}

const note = (id, kind) => ({ id, kind, title: `t-${id}`, body: `b-${id}`, businessId: SHOP });

test("sends every pending notification, not just the latest, to every device", async () => {
  const s = fakeStore({ pending: [note("n1", "reward"), note("n2", "stamp")], tokens: ["tok-a", "tok-b"] });
  const expo = fakeExpo();
  const now = Date.parse("2026-09-25T12:00:00Z");
  const result = await sendPendingPushes(s.store, expo.fetch, USER, SHOP, now);
  assert.equal(result.sent, 2);
  assert.equal(expo.calls.length, 1);
  assert.equal(expo.calls[0].url, "https://exp.host/--/api/v2/push/send");
  assert.equal(expo.calls[0].messages.length, 4, "2 notifications x 2 devices");
  assert.deepEqual(expo.calls[0].messages[0].data, { notificationId: "n1", businessId: SHOP });
  assert.deepEqual(s.marks, [{ ids: ["n1", "n2"], error: null, handled: true }]);
  assert.equal(s.since, "2026-09-25T11:30:00.000Z", "only the last 30 minutes");
});

test("respects notification preferences and never retries opted-out rows", async () => {
  const s = fakeStore({
    pending: [note("n1", "reward"), note("n2", "stamp")],
    settings: { notify_stamps: false, notify_rewards: true },
  });
  const expo = fakeExpo();
  const result = await sendPendingPushes(s.store, expo.fetch, USER, SHOP);
  assert.equal(result.sent, 1);
  assert.equal(result.optedOut, 1);
  assert.deepEqual(expo.calls[0].messages.map((m) => m.data.notificationId), ["n1"]);
  assert.deepEqual(s.marks[0], { ids: ["n2"], error: "recipient opted out", handled: true });
});

test("nothing pending, no device, and a rejected request", async () => {
  assert.equal((await sendPendingPushes(fakeStore().store, fakeExpo().fetch, USER, SHOP)).reason, "no pending notification");

  const noDevice = fakeStore({ pending: [note("n1", "reward")], tokens: [] });
  const r = await sendPendingPushes(noDevice.store, fakeExpo().fetch, USER, SHOP);
  assert.equal(r.reason, "no registered device");
  assert.deepEqual(noDevice.marks, [{ ids: ["n1"], error: "no registered device", handled: true }]);

  const rejected = fakeStore({ pending: [note("n1", "reward")] });
  await assert.rejects(sendPendingPushes(rejected.store, fakeExpo(500).fetch, USER, SHOP), /rejected/);
  assert.deepEqual(rejected.marks, [{ ids: ["n1"], error: "Expo Push Service rejected the request", handled: false }],
    "a rejected request stays unsent so it can be retried");
});

test("per-message delivery errors are recorded", async () => {
  const s = fakeStore({ pending: [note("n1", "reward")], tokens: ["tok-a", "tok-b"] });
  const expo = fakeExpo(200, [{ status: "ok" }, { status: "error", details: { error: "DeviceNotRegistered" } }]);
  const result = await sendPendingPushes(s.store, expo.fetch, USER, SHOP);
  assert.equal(result.deliveryErrors, 1);
  assert.deepEqual(s.marks, [{ ids: ["n1"], error: "DeviceNotRegistered", handled: true }]);
});
