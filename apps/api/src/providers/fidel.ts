import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { TextDecoder } from 'node:util';
import { LosslessNumber, parse } from 'lossless-json';
import { z } from 'zod';
import { WebhookError } from '../lib/errors.js';
import { MAX_BIGINT } from '../services/stamps.js';
import type { LoyaltyTransaction } from '../types/transaction.js';

export interface FidelConfig {
  secret: string;
  webhookUrl: string;
  accountId: string;
  programId: string;
}

export function signFidelBody(rawBody: Buffer, timestamp: string, config: FidelConfig): string {
  const first = createHmac('sha256', config.secret)
    .update(rawBody).update(config.webhookUrl).update(timestamp).digest('base64');
  return createHmac('sha256', config.secret).update(first).digest('base64');
}

export function verifyFidelSignature(
  rawBody: Buffer, signature: string | undefined, timestamp: string | undefined,
  config: FidelConfig, now = Date.now(),
): boolean {
  if (!timestamp || !/^\d{13}$/.test(timestamp) || Math.abs(now - Number(timestamp)) > 300_000) return false;
  if (!signature || !/^[A-Za-z0-9+/]{43}=$/.test(signature)) return false;
  const expected = Buffer.from(signFidelBody(rawBody, timestamp, config), 'ascii');
  const received = Buffer.from(signature, 'ascii');
  return received.length === expected.length && timingSafeEqual(received, expected);
}

const schema = z.object({
  id: z.uuid(),
  accountId: z.uuid(),
  programId: z.uuid(),
  card: z.object({ id: z.uuid() }),
  location: z.object({ id: z.uuid() }),
  amount: z.instanceof(LosslessNumber),
  currency: z.literal('GBP'),
  auth: z.boolean(),
  cleared: z.boolean(),
});

// Fidel sends major units. Preserve the JSON number token; never multiply a JS float.
export function poundsToPence(token: string): bigint {
  const match = /^(0|[1-9]\d{0,16})(?:\.(\d{1,2}))?$/.exec(token);
  if (!match) throw new WebhookError(422, 'invalid_amount');
  const amount = BigInt(match[1]!) * 100n + BigInt((match[2] ?? '').padEnd(2, '0'));
  if (amount > MAX_BIGINT) throw new WebhookError(422, 'invalid_amount');
  return amount;
}

export function parseFidelTransaction(rawBody: Buffer, config: FidelConfig): LoyaltyTransaction {
  let parsed: unknown;
  try {
    parsed = parse(new TextDecoder('utf-8', { fatal: true }).decode(rawBody));
  } catch {
    throw new WebhookError(400, 'invalid_json');
  }
  const result = schema.safeParse(parsed);
  if (!result.success) throw new WebhookError(422, 'invalid_payload');
  const payload = result.data;
  if (payload.accountId !== config.accountId || payload.programId !== config.programId) {
    throw new WebhookError(422, 'wrong_program');
  }
  // Subscribe this endpoint only to transaction.auth. Settlement/refunds need reconciliation.
  if (!payload.auth || payload.cleared) throw new WebhookError(422, 'unsupported_transaction');
  const amountMinor = poundsToPence(payload.amount.value);
  if (amountMinor === 0n) throw new WebhookError(422, 'invalid_amount');
  const fingerprint = createHash('sha256').update(JSON.stringify([
    payload.accountId, payload.programId, payload.id, payload.card.id, payload.location.id,
    amountMinor.toString(), payload.currency,
  ])).digest('hex');
  return {
    provider: 'fidel', externalId: payload.id, programId: payload.programId,
    cardId: payload.card.id, locationId: payload.location.id,
    amountMinor, currency: payload.currency, fingerprint,
  };
}
