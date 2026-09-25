import { Prisma, type PrismaClient } from '../generated/prisma/client.js';
import { WebhookError } from '../lib/errors.js';
import { calculateStamps } from '../services/stamps.js';
import type { LoyaltyTransaction, StampRepository, StampResult } from '../types/transaction.js';

export class PrismaStampRepository implements StampRepository {
  constructor(private readonly db: PrismaClient) {}

  private async duplicate(input: LoyaltyTransaction): Promise<StampResult | null> {
    const existing = await this.db.transaction.findUnique({
      where: { provider_externalId: { provider: input.provider, externalId: input.externalId } },
      include: { ledger: { include: { balance: true } } },
    });
    if (!existing) return null;
    if (existing.fingerprint !== input.fingerprint) throw new WebhookError(409, 'transaction_conflict');
    if (!existing.ledger) throw new Error('Missing transaction ledger');
    return {
      duplicate: true, stampsEarned: existing.ledger.stamps.toString(),
      provisionalStampBalance: existing.ledger.balance.provisional.toString(),
    };
  }

  async credit(input: LoyaltyTransaction): Promise<StampResult> {
    // Fast path only. The database unique constraint below is the concurrency guard.
    const duplicate = await this.duplicate(input);
    if (duplicate) return duplicate;
    try {
      return await this.db.$transaction(async tx => {
        const location = await tx.merchantLocation.findUnique({
          where: { provider_programId_externalLocationId: {
            provider: input.provider, programId: input.programId, externalLocationId: input.locationId,
          } }, include: { merchant: true },
        });
        if (!location) throw new WebhookError(422, 'unknown_merchant');
        const card = await tx.linkedCard.findUnique({
          where: { provider_programId_externalCardId: {
            provider: input.provider, programId: input.programId, externalCardId: input.cardId,
          } },
        });
        if (!card || !card.active) throw new WebhookError(422, 'unknown_card');
        if (location.merchant.currency !== input.currency) throw new WebhookError(422, 'currency_mismatch');
        const threshold = location.merchant.stampThresholdMinor;
        const stamps = calculateStamps(input.amountMinor, threshold);
        const transaction = await tx.transaction.create({ data: {
          provider: input.provider, externalId: input.externalId, fingerprint: input.fingerprint,
          linkedCardId: card.id, merchantLocationId: location.id,
          amountMinor: input.amountMinor, currency: input.currency, stampThresholdMinor: threshold,
        } });
        // Database-native upsert + increment prevents lost updates across different purchases.
        const balance = await tx.stampBalance.upsert({
          where: { userId_merchantId: { userId: card.userId, merchantId: location.merchantId } },
          create: { userId: card.userId, merchantId: location.merchantId, provisional: stamps },
          update: { provisional: { increment: stamps } },
        });
        await tx.stampLedger.create({ data: {
          transactionId: transaction.id, userId: card.userId, merchantId: location.merchantId, stamps,
        } });
        return { duplicate: false, stampsEarned: stamps.toString(), provisionalStampBalance: balance.provisional.toString() };
      }, { maxWait: 3000, timeout: 8000 });
    } catch (error) {
      // A racing insert waits for the winner to commit. Read only after our rollback.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const result = await this.duplicate(input);
        if (result) return result;
      }
      throw error;
    }
  }
}
