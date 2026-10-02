// Shops an admin picked for "Trending", in the admin's order. Until an admin
// has picked any shop, keep the old behaviour: the first few shops listed.
// A pick needs an admin-set position, so an owner flipping `trending` alone
// (possible before 20261002233000 is applied) can't promote their shop.
// Kept identical to apps/shopper/src/trending.ts (tested together).
type TrendingFields = { trending?: boolean | null; trending_position?: number | null }

const isPick = (shop: TrendingFields) => Boolean(shop.trending) && shop.trending_position != null

export function trendingShops<T extends TrendingFields>(
  all: T[],
  filtered: T[],
  { fallback, limit }: { fallback: number; limit?: number },
): T[] {
  if (!all.some(isPick)) return filtered.slice(0, fallback)
  const picks = filtered
    .filter(isPick)
    .sort((a, b) => (a.trending_position ?? 0) - (b.trending_position ?? 0))
  return limit === undefined ? picks : picks.slice(0, limit)
}
