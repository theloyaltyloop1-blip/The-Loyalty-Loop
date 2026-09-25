import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { WebhookError } from '../src/lib/errors.js';
import { readConfig } from '../src/lib/config.js';
import { parseFidelTransaction, poundsToPence, signFidelBody, verifyFidelSignature } from '../src/providers/fidel.js';
import { calculateStamps, MAX_BIGINT } from '../src/services/stamps.js';
import type { LoyaltyTransaction } from '../src/types/transaction.js';
import { config, payload } from './fixtures.js';

function harness() {
  const calls: LoyaltyTransaction[] = [];
  const app = createApp(config, { async credit(input) {
    calls.push(input);
    return { duplicate: false, stampsEarned: '2', provisionalStampBalance: '2' };
  } });
  function send(body = JSON.stringify(payload), signature?: string, timestamp = String(Date.now())) {
    return request(app).post('/webhooks/fidel').set('Content-Type', 'application/json')
      .set('x-fidel-timestamp', timestamp)
      .set('x-fidel-signature', signature ?? signFidelBody(Buffer.from(body), timestamp, config)).send(body);
  }
  return { calls, app, send };
}

test('valid raw webhook is authenticated and normalized to integer pence', async () => {
  const { calls, send } = harness();
  const response = await send();
  assert.equal(response.status, 200);
  assert.equal(response.body.provisionalStampBalance, '2');
  assert.equal(calls[0]?.amountMinor, 1250n);
});

test('signature matches the documented double HMAC with base64 at each step', () => {
  const body = Buffer.from('{ "amount": 12.50 }');
  const timestamp = '1790000000000';
  const digest = (value: string) => createHmac('sha256', config.secret).update(value).digest('base64');
  const expected = digest(digest(body.toString() + config.webhookUrl + timestamp));
  assert.equal(signFidelBody(body, timestamp, config), expected);
  assert.equal(verifyFidelSignature(body, expected, timestamp, config, Number(timestamp)), true);
  assert.equal(verifyFidelSignature(Buffer.from('{"amount":12.5}'), expected, timestamp, config, Number(timestamp)), false);
  assert.equal(verifyFidelSignature(body, expected, timestamp, { ...config, webhookUrl: config.webhookUrl + '/' }, Number(timestamp)), false);
  assert.equal(verifyFidelSignature(body, expected, timestamp, { ...config, secret: 'wrong' }, Number(timestamp)), false);
});

test('invalid signatures are rejected before malformed JSON parsing or persistence', async () => {
  const { calls, send, app } = harness();
  for (const signature of ['invalid', 'A'.repeat(43) + '=', 'é'.repeat(44)]) {
    assert.equal((await send('{', signature)).status, 401);
  }
  assert.equal((await request(app).post('/webhooks/fidel').send(payload)).status, 401);
  assert.equal(calls.length, 0);
});

test('expired and future timestamps are rejected; malformed timestamps cannot bypass freshness', async () => {
  const { send, calls } = harness();
  for (const timestamp of [String(Date.now() - 301_000), String(Date.now() + 301_000), 'NaN', 'Infinity', '']) {
    assert.equal((await send(undefined, undefined, timestamp)).status, 401);
  }
  assert.equal(calls.length, 0);
});

test('signed malformed JSON, duplicate keys, and invalid payloads do not reach persistence', async () => {
  const { send, calls } = harness();
  assert.equal((await send('{')).status, 400);
  assert.equal((await send('{"id":1,"id":2}')).status, 400);
  for (const override of [
    { card: {} }, { currency: 'USD' }, { auth: false }, { cleared: true },
    { amount: '12.50' }, { amount: -5 }, { amount: 0 }, { amount: 1.001 },
    { accountId: payload.id }, { programId: payload.id },
  ]) {
    assert.equal((await send(JSON.stringify({ ...payload, ...override }))).status, 422);
  }
  assert.equal(calls.length, 0);
});

test('body limits and media/encoding restrictions apply', async () => {
  const { app, send, calls } = harness();
  assert.equal((await send(' '.repeat(65 * 1024))).status, 413);
  assert.equal((await request(app).post('/webhooks/fidel').type('text').send('{}')).status, 415);
  assert.equal((await request(app).post('/webhooks/fidel').set('Content-Encoding', 'gzip').send(payload)).status, 415);
  assert.equal(calls.length, 0);
});

test('amount conversion and custom thresholds use exact integer arithmetic', () => {
  for (const [token, pence, stamps] of [
    ['0.01', 1n, 0n], ['4.99', 499n, 0n], ['5', 500n, 1n],
    ['9.99', 999n, 1n], ['12.50', 1250n, 2n], ['0.29', 29n, 0n],
    ['92233720368547758.07', MAX_BIGINT, MAX_BIGINT / 500n],
  ] as const) {
    assert.equal(poundsToPence(token), pence);
    assert.equal(calculateStamps(pence, 500n), stamps);
  }
  assert.equal(calculateStamps(1250n, 300n), 4n);
  for (const value of ['1.001', '-1', '1e2', 'NaN', '92233720368547758.08']) assert.throws(() => poundsToPence(value));
  for (const threshold of [0n, -1n, MAX_BIGINT + 1n]) assert.throws(() => calculateStamps(500n, threshold));
  assert.throws(() => calculateStamps(-1n, 500n));
});

test('JSON number precision is preserved instead of rounded into eligibility', () => {
  const body = JSON.stringify(payload).replace('12.5', '4.9999999999999999999');
  assert.throws(() => parseFidelTransaction(Buffer.from(body), config), WebhookError);
});

test('controlled persistence errors expose only safe error codes', async () => {
  const app = createApp(config, { async credit() { throw new WebhookError(422, 'unknown_card'); } });
  const body = JSON.stringify(payload);
  const timestamp = String(Date.now());
  const response = await request(app).post('/webhooks/fidel').type('json')
    .set('x-fidel-timestamp', timestamp).set('x-fidel-signature', signFidelBody(Buffer.from(body), timestamp, config)).send(body);
  assert.equal(response.status, 422);
  assert.deepEqual(response.body, { error: 'unknown_card' });
});

test('startup rejects missing secrets, invalid IDs, or non-HTTPS external URLs', () => {
  const env = {
    DATABASE_URL: 'postgresql://localhost/test', FIDEL_WEBHOOK_SECRET: config.secret,
    FIDEL_WEBHOOK_URL: config.webhookUrl, FIDEL_ACCOUNT_ID: config.accountId, FIDEL_PROGRAM_ID: config.programId,
  };
  assert.equal(readConfig(env).port, 3001);
  assert.throws(() => readConfig({ ...env, FIDEL_WEBHOOK_SECRET: '' }));
  assert.throws(() => readConfig({ ...env, FIDEL_WEBHOOK_URL: 'http://external.example/webhooks/fidel' }));
  assert.throws(() => readConfig({ ...env, FIDEL_ACCOUNT_ID: 'wrong' }));
});
