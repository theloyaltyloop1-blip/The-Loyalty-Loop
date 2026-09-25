import assert from "node:assert/strict";
import { test } from "node:test";
import { handleFidelWebhook } from "./handler.ts";
import { fidelSignature } from "./signature.ts";

const url = "https://project.example/functions/v1/fidel-webhook?event=transaction.auth";
const secret = "synthetic-fidel-webhook-secret";
const route = { eventType: "transaction.auth", registeredUrl: url, secretKey: secret };

function authPayload(overrides = {}) {
  return JSON.stringify({
    id: "synthetic-auth-1",
    programId: "synthetic-program",
    currency: "GBP",
    card: { id: "synthetic-card" },
    location: { id: "synthetic-location" },
    auth: true,
    cleared: false,
    amount: 12.5,
    ...overrides,
  });
}

async function signedSyntheticRequest(body, options = {}) {
  const timestamp = String(Date.now());
  const signature = await fidelSignature(body, url, timestamp, secret);
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-fidel-timestamp": timestamp,
      "x-fidel-signature": signature,
      "fidel-message-id": "synthetic-message-1",
      ...(options.headers ?? {}),
    },
    body,
  });
}

test("synthetic signed authorization reaches exactly one atomic RPC", async () => {
  const calls = [];
  const request = await signedSyntheticRequest(authPayload());
  const response = await handleFidelWebhook(request, {
    routeFor: (requestUrl) => requestUrl === url ? route : null,
    admin: {
      rpc: async (name, args) => {
        calls.push({ name, args });
        return { data: { status: "processed" }, error: null };
      },
    },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "processed" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, "process_fidel_webhook_event");
  assert.deepEqual(calls[0].args, {
    _fidel_message_id: "synthetic-message-1",
    _event_type: "transaction.auth",
    _fidel_transaction_id: "synthetic-auth-1",
    _program_id: "synthetic-program",
    _fidel_card_id: "synthetic-card",
    _fidel_location_id: "synthetic-location",
    _original_transaction_id: null,
    _amount_pence: 1250,
    _auth: true,
    _cleared: false,
  });
});

test("synthetic tampered and malformed payloads never call the RPC", async () => {
  let calls = 0;
  const admin = { rpc: async () => { calls += 1; return { data: { status: "processed" }, error: null }; } };
  const validBody = authPayload();
  const timestamp = String(Date.now());
  const validSignature = await fidelSignature(validBody, url, timestamp, secret);
  const tampered = new Request(url, {
    method: "POST",
    headers: {
      "x-fidel-timestamp": timestamp,
      "x-fidel-signature": validSignature,
      "fidel-message-id": "synthetic-message-2",
    },
    body: authPayload({ amount: 13.5 }),
  });
  assert.equal((await handleFidelWebhook(tampered, { routeFor: () => route, admin })).status, 401);

  const malformed = await signedSyntheticRequest(authPayload({ currency: "USD" }), {
    headers: { "fidel-message-id": "synthetic-message-3" },
  });
  assert.equal((await handleFidelWebhook(malformed, { routeFor: () => route, admin })).status, 400);
  assert.equal(calls, 0);
});

test("synthetic duplicate and reconciliation outcomes acknowledge without retry status", async () => {
  for (const outcome of ["duplicate", "unknown_merchant", "unknown_card", "unresolved_refund"]) {
    const request = await signedSyntheticRequest(authPayload(), {
      headers: { "fidel-message-id": `synthetic-${outcome}` },
    });
    const response = await handleFidelWebhook(request, {
      routeFor: () => route,
      admin: { rpc: async () => ({ data: { status: outcome }, error: null }) },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: outcome });
  }
});

test("synthetic permanent refund rejection returns 400 after durable RPC handling", async () => {
  const request = await signedSyntheticRequest(authPayload(), {
    headers: { "fidel-message-id": "synthetic-invalid-refund" },
  });
  const response = await handleFidelWebhook(request, {
    routeFor: () => route,
    admin: { rpc: async () => ({ data: { status: "invalid_refund" }, error: null }) },
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { status: "invalid_refund" });
});

test("synthetic zero-value authorization is acknowledged as a ledgered no-op", async () => {
  const calls = [];
  const request = await signedSyntheticRequest(authPayload({ amount: 0 }), {
    headers: { "fidel-message-id": "synthetic-zero-auth" },
  });
  const response = await handleFidelWebhook(request, {
    routeFor: () => route,
    admin: {
      rpc: async (name, args) => {
        calls.push({ name, args });
        return { data: { status: "ignored_zero_amount" }, error: null };
      },
    },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ignored_zero_amount" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].args._amount_pence, 0);
});

test("synthetic requests for an unconfigured route do not read or process payloads", async () => {
  const request = await signedSyntheticRequest(authPayload());
  const response = await handleFidelWebhook(request, {
    routeFor: () => null,
    admin: { rpc: async () => { throw new Error("must not be called"); } },
  });
  assert.equal(response.status, 404);
});

test("synthetic credited purchase triggers the after-processing hook once; other outcomes do not", async () => {
  for (const [outcome, expected] of [["processed", 1], ["duplicate", 0], ["unknown_merchant", 0]]) {
    const hooks = [];
    const request = await signedSyntheticRequest(authPayload(), {
      headers: { "fidel-message-id": `synthetic-hook-${outcome}` },
    });
    const response = await handleFidelWebhook(request, {
      routeFor: () => route,
      admin: { rpc: async () => ({ data: { status: outcome }, error: null }) },
      onProcessed: (event) => hooks.push(event),
    });
    assert.equal(response.status, 200);
    assert.equal(hooks.length, expected, outcome);
    if (expected) assert.deepEqual(hooks[0], { eventType: "transaction.auth", fidelTransactionId: "synthetic-auth-1" });
  }
});

test("synthetic after-processing hook failure never changes the response to Fidel", async () => {
  const request = await signedSyntheticRequest(authPayload(), {
    headers: { "fidel-message-id": "synthetic-hook-throws" },
  });
  const original = console.error;
  console.error = () => {};
  try {
    const response = await handleFidelWebhook(request, {
      routeFor: () => route,
      admin: { rpc: async () => ({ data: { status: "processed" }, error: null }) },
      onProcessed: () => { throw new Error("push down"); },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "processed" });
  } finally {
    console.error = original;
  }
});
