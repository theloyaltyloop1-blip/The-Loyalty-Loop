import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { readConfig } from '../src/lib/config.js';
import { poundsToPence, signFidelBody } from '../src/providers/fidel.js';

// Explicitly synthetic payload using documented Fidel fields. No credentials are embedded.
const config = readConfig();
const cardId = z.uuid().parse(process.env.MOCK_CARD_ID);
const locationId = z.uuid().parse(process.env.MOCK_LOCATION_ID);
const transactionId = z.uuid().parse(process.env.MOCK_TRANSACTION_ID ?? randomUUID());
const amount = process.env.MOCK_AMOUNT_GBP ?? '12.50';
poundsToPence(amount);
const body = Buffer.from(JSON.stringify({
  id: transactionId, accountId: config.fidel.accountId, programId: config.fidel.programId,
  card: { id: cardId }, location: { id: locationId },
  auth: true, cleared: false, currency: 'GBP', amount: '__EXACT_AMOUNT__',
}).replace('"__EXACT_AMOUNT__"', amount));
const timestamp = String(Date.now());
const response = await fetch(config.fidel.webhookUrl, {
  method: 'POST', redirect: 'error',
  headers: {
    'Content-Type': 'application/json', 'x-fidel-timestamp': timestamp,
    'x-fidel-signature': signFidelBody(body, timestamp, config.fidel),
  }, body, signal: AbortSignal.timeout(15_000),
});
console.info(`Transaction ${transactionId}: HTTP ${response.status} ${await response.text()}`);
if (!response.ok) process.exitCode = 1;
