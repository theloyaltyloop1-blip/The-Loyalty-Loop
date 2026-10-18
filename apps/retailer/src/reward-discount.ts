// "£ off" rewards (reward_catalog.discount_pence): staff type the bill total
// and the app shows what to charge on the card machine. Pure so it can be
// unit-tested without React Native.

/** Parses a typed amount ("12", "£12.50", "Rs 1,200") to minor units, or null. */
export function parsePounds(value: string): number | null {
  const cleaned = value.replace(/£|rs|[,\s]/gi, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

/** Amount left to charge after the reward; never below zero. */
export function chargeAfterDiscount(billPence: number, discountPence: number): number {
  return Math.max(0, billPence - discountPence);
}

/** Reads discount_pence from a rewards row joined to reward_catalog. */
export function rewardDiscountPence(row: { catalog?: unknown }): number | null {
  const catalog = Array.isArray(row.catalog) ? row.catalog[0] : row.catalog;
  const value = (catalog as { discount_pence?: unknown } | null | undefined)?.discount_pence;
  return typeof value === "number" && value > 0 ? value : null;
}
