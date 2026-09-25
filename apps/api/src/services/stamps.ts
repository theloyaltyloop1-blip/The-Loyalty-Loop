export const MAX_BIGINT = 9_223_372_036_854_775_807n;

// Per-purchase whole stamps; remainders do not carry between purchases.
export function calculateStamps(amountMinor: bigint, thresholdMinor: bigint): bigint {
  if (amountMinor < 0n || amountMinor > MAX_BIGINT || thresholdMinor <= 0n || thresholdMinor > MAX_BIGINT) {
    throw new RangeError('Invalid stamp amount or threshold');
  }
  return amountMinor / thresholdMinor;
}
