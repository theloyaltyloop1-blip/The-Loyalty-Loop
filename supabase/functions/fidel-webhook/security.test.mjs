import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { fidelSignature, verifyFidelSignature } from './signature.ts';
import { amountStringToPence, topLevelAmountToken } from './amount.ts';
import { parseFidelTransaction } from './transaction.ts';

test('Fidel signature matches an independent double-HMAC reference', async () => {
  const body = '{"id":"txn-1","amount":5.44}';
  const url = 'https://example.test/functions/v1/fidel-webhook';
  const timestamp = '1760000000000';
  const secret = 'sandbox-webhook-secret';
  const hmac = value => createHmac('sha256', secret).update(value).digest('base64');
  const expected = hmac(hmac(body + url + timestamp));
  assert.equal(await fidelSignature(body, url, timestamp, secret), expected);
  assert.equal(await verifyFidelSignature({
    rawBody: body, webhookUrl: url, timestamp, signature: expected,
    secretKey: secret, nowMs: Number(timestamp)
  }), true);
  for (const changed of [
    { rawBody: body + ' ' },
    { webhookUrl: url + '/' },
    { signature: expected.slice(0, -1) + 'A' },
    { timestamp: String(Number(timestamp) - 300001) },
    { timestamp: String(Number(timestamp) + 300001) }
  ]) {
    assert.equal(await verifyFidelSignature({
      rawBody: body, webhookUrl: url, timestamp, signature: expected,
      secretKey: secret, nowMs: Number(timestamp), ...changed
    }), false);
  }
  assert.equal(await verifyFidelSignature({
    rawBody: body, webhookUrl: url, timestamp: 'not-a-timestamp',
    signature: expected, secretKey: secret
  }), false);
});

test('Fidel decimal amounts become exact integer pence', () => {
  for (const [amount, pence] of [
    ['5', 500], ['5.4', 540], ['5.44', 544], ['0.01', 1],
    ['0', 0], ['-0.01', -1], ['-10', -1000],
    ['21474836.47', 2147483647], ['-21474836.48', -2147483648]
  ]) {
    assert.equal(amountStringToPence(amount), pence);
  }
  for (const invalid of [
    '5.444', '5.', '+1', '01.00', '1e2', 'NaN',
    '21474836.48', '-21474836.49', '', ' 5.44'
  ]) {
    assert.throws(() => amountStringToPence(invalid));
  }
});

test('amount token comes from the top-level signed JSON, even when nested amounts precede it', () => {
  const raw = '{"offer":{"amount":999},"card":{"metadata":{"amount":888}},"amount":-5.44}';
  assert.equal(topLevelAmountToken(raw), '-5.44');
  assert.equal(amountStringToPence(topLevelAmountToken(raw)), -544);
  assert.throws(() => topLevelAmountToken('{"amount":1,"amount":2}'), /duplicate/);
  assert.throws(() => topLevelAmountToken('{"amount":"5.44"}'), /JSON number/);
  assert.throws(() => amountStringToPence(topLevelAmountToken('{"amount":1e2}')));
});

test('bare Fidel transaction payload validates signed event semantics', () => {
  const base = {
    id: 'transaction-1', programId: 'program-1', currency: 'GBP',
    card: { id: 'card-1' }, location: { id: 'location-1' },
    auth: true, cleared: false, amount: 5.44
  };
  assert.equal(parseFidelTransaction(JSON.stringify(base), 'transaction.auth').amountPence, 544);
  assert.equal(
    parseFidelTransaction(JSON.stringify({ ...base, amount: 0 }), 'transaction.auth').amountPence,
    0,
  );
  const refund = {
    ...base, id: 'refund-1', originalTransactionId: 'transaction-1',
    auth: false, cleared: true, amount: -2.5
  };
  assert.equal(parseFidelTransaction(JSON.stringify(refund), 'transaction.refund').amountPence, -250);
  assert.throws(() => parseFidelTransaction(JSON.stringify(refund), 'transaction.auth'));
  assert.throws(() => parseFidelTransaction(JSON.stringify({ ...base, currency: 'USD' }), 'transaction.auth'));
  assert.throws(() => parseFidelTransaction(JSON.stringify({ ...base, card: {} }), 'transaction.auth'));
  assert.throws(() => parseFidelTransaction(JSON.stringify({ ...refund, amount: 0 }), 'transaction.refund'));
});
