import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import { resolve, sep } from 'node:path';
import { after, before, beforeEach, test } from 'node:test';
import EmbeddedPostgres from 'embedded-postgres';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createPrisma } from '../../src/lib/prisma.js';
import { signFidelBody } from '../../src/providers/fidel.js';
import { PrismaStampRepository } from '../../src/repositories/stamps.js';
import { config, payload } from '../fixtures.js';

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test port');
  await new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done()));
  return address.port;
}

let postgres: EmbeddedPostgres;
let prisma: ReturnType<typeof createPrisma>;
let app: ReturnType<typeof createApp>;
let merchantId: string;
let userId: string;
let started = false;

before(async () => {
  // Always create our own cluster; never read DATABASE_URL or touch existing databases.
  const root = resolve('.test-postgres');
  const databaseDir = resolve(root, randomUUID());
  if (!databaseDir.startsWith(root + sep)) throw new Error('Unsafe test directory');
  await mkdir(root, { recursive: true });
  const port = await freePort();
  const password = randomUUID();
  postgres = new EmbeddedPostgres({
    databaseDir, port, password, user: 'postgres', persistent: false,
    authMethod: 'scram-sha-256', postgresFlags: ['-h', '127.0.0.1'],
    onLog: () => {}, onError: () => {},
  });
  await postgres.initialise();
  await postgres.start();
  started = true;
  await postgres.createDatabase('loyalty_test');
  const client = postgres.getPgClient('loyalty_test', '127.0.0.1');
  await client.connect();
  try {
    await client.query(await readFile('prisma/migrations/20260922090000_card_linked_stamps/migration.sql', 'utf8'));
  } finally { await client.end(); }
  prisma = createPrisma(`postgresql://postgres:${password}@127.0.0.1:${port}/loyalty_test`);
  app = createApp(config, new PrismaStampRepository(prisma));
}, { timeout: 60_000 });

after(async () => {
  await prisma?.$disconnect();
  if (started) await postgres.stop();
});

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE card_linked."User", card_linked."Merchant" CASCADE');
  const user = await prisma.user.create({ data: {} });
  const merchant = await prisma.merchant.create({ data: { stampThresholdMinor: 500n } });
  userId = user.id;
  merchantId = merchant.id;
  await prisma.linkedCard.create({ data: { userId, programId: config.programId, externalCardId: payload.card.id } });
  await prisma.merchantLocation.create({ data: { merchantId, programId: config.programId, externalLocationId: payload.location.id } });
});

function send(overrides: Record<string, unknown> = {}) {
  const body = JSON.stringify({ ...payload, ...overrides });
  const timestamp = String(Date.now());
  return request(app).post('/webhooks/fidel').type('json').set('x-fidel-timestamp', timestamp)
    .set('x-fidel-signature', signFidelBody(Buffer.from(body), timestamp, config)).send(body);
}

async function counts() {
  return Promise.all([prisma.transaction.count(), prisma.stampLedger.count(), prisma.stampBalance.count()]);
}

test('commits normalized purchase, threshold snapshot, ledger, and merchant/customer balance', async () => {
  const response = await send();
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: 'provisional', duplicate: false, stampsEarned: '2', provisionalStampBalance: '2' });
  assert.deepEqual(await counts(), [1, 1, 1]);
  const transaction = await prisma.transaction.findFirstOrThrow();
  assert.equal(transaction.amountMinor, 1250n);
  assert.equal(transaction.stampThresholdMinor, 500n);
});

test('duplicate retries do not credit twice, even after merchant threshold changes', async () => {
  assert.equal((await send()).status, 200);
  await prisma.merchant.update({ where: { id: merchantId }, data: { stampThresholdMinor: 100n } });
  const response = await send();
  assert.equal(response.status, 200);
  assert.equal(response.body.duplicate, true);
  assert.equal(response.body.provisionalStampBalance, '2');
  assert.deepEqual(await counts(), [1, 1, 1]);
});

test('12 simultaneous duplicate requests create exactly one credit', async () => {
  const responses = await Promise.all(Array.from({ length: 12 }, () => send()));
  assert.ok(responses.every(response => response.status === 200), JSON.stringify(responses.map(response => response.body)));
  assert.equal(responses.filter(response => !response.body.duplicate).length, 1);
  assert.equal((await prisma.stampBalance.findFirstOrThrow()).provisional, 2n);
  assert.deepEqual(await counts(), [1, 1, 1]);
});

test('different simultaneous purchases do not lose balance increments', async () => {
  const responses = await Promise.all(Array.from({ length: 8 }, () => send({ id: randomUUID() })));
  assert.ok(responses.every(response => response.status === 200), JSON.stringify(responses.map(response => response.body)));
  assert.equal((await prisma.stampBalance.findFirstOrThrow()).provisional, 16n);
  assert.deepEqual(await counts(), [8, 8, 1]);
});

test('unknown merchant/card and inactive card make no writes', async () => {
  assert.equal((await send({ location: { id: randomUUID() } })).body.error, 'unknown_merchant');
  assert.equal((await send({ card: { id: randomUUID() } })).body.error, 'unknown_card');
  await prisma.linkedCard.updateMany({ data: { active: false } });
  assert.equal((await send()).body.error, 'unknown_card');
  assert.deepEqual(await counts(), [0, 0, 0]);
});

test('same transaction ID with altered amount is a conflict, not a second credit', async () => {
  await send();
  const response = await send({ amount: 50 });
  assert.equal(response.status, 409);
  assert.equal((await prisma.stampBalance.findFirstOrThrow()).provisional, 2n);
  assert.deepEqual(await counts(), [1, 1, 1]);
});

test('late ledger failure rolls back transaction and balance; replay succeeds after recovery', async () => {
  await prisma.$executeRawUnsafe('ALTER TABLE card_linked."StampLedger" ADD CONSTRAINT test_failure CHECK (stamps < 0)');
  try {
    assert.equal((await send()).status, 503);
    assert.deepEqual(await counts(), [0, 0, 0]);
  } finally {
    await prisma.$executeRawUnsafe('ALTER TABLE card_linked."StampLedger" DROP CONSTRAINT test_failure');
  }
  assert.equal((await send()).status, 200);
  assert.deepEqual(await counts(), [1, 1, 1]);
});

test('sub-threshold purchases record zero stamps; remainder does not carry', async () => {
  assert.equal((await send({ amount: 4.99 })).body.stampsEarned, '0');
  assert.equal((await send({ id: randomUUID(), amount: 4.99 })).body.provisionalStampBalance, '0');
  assert.deepEqual(await counts(), [2, 2, 1]);
});

test('database rejects invalid threshold even when application validation is bypassed', async () => {
  await assert.rejects(prisma.merchant.update({ where: { id: merchantId }, data: { stampThresholdMinor: 0n } }));
  await assert.rejects(prisma.merchant.update({ where: { id: merchantId }, data: { stampThresholdMinor: -1n } }));
});

test('card and merchant balances stay separate', async () => {
  await send();
  const another = await prisma.merchant.create({ data: { stampThresholdMinor: 1000n } });
  const locationId = randomUUID();
  await prisma.merchantLocation.create({ data: { merchantId: another.id, programId: config.programId, externalLocationId: locationId } });
  const response = await send({ id: randomUUID(), location: { id: locationId } });
  assert.equal(response.body.provisionalStampBalance, '1');
  assert.equal(await prisma.stampBalance.count(), 2);
});
