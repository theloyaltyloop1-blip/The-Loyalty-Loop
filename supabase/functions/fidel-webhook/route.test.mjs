import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { handleFidelWebhook } from "./handler.ts";
import { configuredRoute } from "./route.ts";
import { fidelSignature } from "./signature.ts";

// All configuration, signatures and transactions in this file are synthetic.
// These tests do not establish Fidel's real sandbox signing contract.
const selectors = ["auth", "clearing", "refund"];
const publicUrl = (selector) =>
  `https://synthetic.example/functions/v1/fidel-webhook?event=${selector}`;
const runtimeUrl = (selector) =>
  `http://127.0.0.1:8000/fidel-webhook?event=${selector}`;

function syntheticConfig(sharedSecret = false) {
  const shared = randomUUID();
  return new Map(selectors.flatMap((selector) => {
    const prefix = selector.toUpperCase();
    return [
      [`FIDEL_WEBHOOK_${prefix}_URL`, publicUrl(selector)],
      [`FIDEL_WEBHOOK_${prefix}_SECRET`, sharedSecret ? shared : randomUUID()],
    ];
  }));
}

test("synthetic runtime-shaped URLs select the three configured public routes", () => {
  const env = syntheticConfig();
  for (const selector of selectors) {
    assert.deepEqual(configuredRoute(runtimeUrl(selector), (name) => env.get(name)), {
      eventType: `transaction.${selector}`,
      registeredUrl: publicUrl(selector),
      secretKey: env.get(`FIDEL_WEBHOOK_${selector.toUpperCase()}_SECRET`),
    });
  }
});

test("synthetic missing, ambiguous and unknown selectors never select a route", () => {
  const base = "http://127.0.0.1:8000/fidel-webhook";
  for (const suffix of [
    "", "?event", "?event=", "?event=auth&event=auth",
    "?event=auth&event=refund", "?event=AUTH", "?event=transaction.auth",
    "?event=__proto__", "?event=bogus", "?event=constructor",
  ]) {
    assert.equal(configuredRoute(base + suffix, () => {
      assert.fail("invalid selectors must not read configuration");
    }), null, suffix);
  }
  assert.equal(configuredRoute("not a URL", () => {
    assert.fail("an unparseable request URL must not read configuration");
  }), null);
});

test("synthetic misconfigured registered URLs fail closed and log only the prefix", (t) => {
  const log = t.mock.method(console, "error", () => {});
  const valid = publicUrl("auth");
  const invalidUrls = [
    publicUrl("clearing"),
    valid + "\n",
    " " + valid,
    valid + "&extra=1",
    valid + "#fragment",
    valid.replace("https:", "http:"),
    valid.split("?")[0],
    "not a URL",
    valid.replace("synthetic.example", "SYNTHETIC.EXAMPLE"),
    valid.replace("synthetic.example", "synthetic.example:443"),
  ];
  for (const registeredUrl of invalidUrls) {
    const env = syntheticConfig();
    env.set("FIDEL_WEBHOOK_AUTH_URL", registeredUrl);
    assert.equal(configuredRoute(runtimeUrl("auth"), (name) => env.get(name)), null);
  }
  assert.equal(log.mock.callCount(), invalidUrls.length);
  for (const call of log.mock.calls) {
    assert.deepEqual(call.arguments, ["fidel-webhook route misconfigured", "AUTH"]);
  }
});

test("synthetic missing or empty route configuration fails closed", () => {
  for (const name of ["FIDEL_WEBHOOK_AUTH_URL", "FIDEL_WEBHOOK_AUTH_SECRET"]) {
    for (const value of [undefined, ""]) {
      const env = syntheticConfig();
      env.set(name, value);
      assert.equal(configuredRoute(runtimeUrl("auth"), (key) => env.get(key)), null);
    }
  }
});

async function verifySyntheticAuthRouteBinding(sharedSecret) {
  const env = syntheticConfig(sharedSecret);
  const calls = [];
  const dependencies = {
    routeFor: (requestUrl) => configuredRoute(requestUrl, (name) => env.get(name)),
    admin: {
      rpc: async (name, args) => {
        calls.push({ name, args });
        return { data: { status: "processed" }, error: null };
      },
    },
  };
  const body = JSON.stringify({
    id: "synthetic-route-auth",
    programId: "synthetic-program",
    currency: "GBP",
    card: { id: "synthetic-card" },
    location: { id: "synthetic-location" },
    auth: true,
    cleared: false,
    amount: 12.5,
  });
  const timestamp = String(Date.now());
  const signature = await fidelSignature(
    body, publicUrl("auth"), timestamp, env.get("FIDEL_WEBHOOK_AUTH_SECRET"),
  );
  for (const [selector, expectedStatus, expectedBody] of [
    ["auth", 200, { status: "processed" }],
    ["refund", 401, { error: "invalid_signature" }],
    ["clearing", 401, { error: "invalid_signature" }],
    ["bogus", 404, { error: "unconfigured_webhook_route" }],
  ]) {
    const before = calls.length;
    const request = new Request(runtimeUrl(selector), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-fidel-timestamp": timestamp,
        "x-fidel-signature": signature,
        "fidel-message-id": "synthetic-route-message",
      },
      body,
    });
    const response = await handleFidelWebhook(request, dependencies);
    assert.equal(response.status, expectedStatus, selector);
    assert.deepEqual(await response.json(), expectedBody, selector);
    assert.equal(calls.length - before, expectedStatus === 200 ? 1 : 0,
      `${selector}: rejected deliveries must never call the RPC`);
  }
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, "process_fidel_webhook_event");
  assert.equal(calls[0].args._event_type, "transaction.auth");
  assert.equal(calls[0].args._amount_pence, 1250);
}

test("synthetic signed auth is accepted only on auth and rejected routes never call RPC", async () => {
  await verifySyntheticAuthRouteBinding(false);
});

test("synthetic signed URL binding prevents cross-route replay even with a shared secret", async () => {
  await verifySyntheticAuthRouteBinding(true);
});
