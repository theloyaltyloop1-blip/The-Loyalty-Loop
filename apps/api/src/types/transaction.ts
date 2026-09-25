export interface LoyaltyTransaction {
  provider: 'fidel';
  externalId: string;
  programId: string;
  cardId: string;
  locationId: string;
  amountMinor: bigint;
  currency: 'GBP';
  fingerprint: string;
}

export interface StampResult {
  duplicate: boolean;
  stampsEarned: string;
  provisionalStampBalance: string;
}

export interface StampRepository {
  credit(transaction: LoyaltyTransaction): Promise<StampResult>;
}
