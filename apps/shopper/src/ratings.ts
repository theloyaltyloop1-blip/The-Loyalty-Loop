// Star summaries for shops ("★ 4.6 (12)"), shown to everyone, joined or not.
// Pure so node tests can load it.

export type RatingStats = { rating_avg?: number | null; rating_count?: number | null }

export function ratingStats(rows: { business_id: string; rating: number }[]): Map<string, { rating_avg: number; rating_count: number }> {
  const totals = new Map<string, { sum: number; count: number }>()
  for (const row of rows) {
    if (!(row.rating >= 1 && row.rating <= 5)) continue
    const total = totals.get(row.business_id) ?? { sum: 0, count: 0 }
    total.sum += row.rating
    total.count += 1
    totals.set(row.business_id, total)
  }
  const stats = new Map<string, { rating_avg: number; rating_count: number }>()
  totals.forEach((total, id) => stats.set(id, { rating_avg: total.sum / total.count, rating_count: total.count }))
  return stats
}

/** "★ 4.6 (12)", or null when nobody has reviewed the shop yet. */
export function ratingLabel(shop: RatingStats): string | null {
  if (!shop.rating_count || !shop.rating_avg) return null
  return `★ ${shop.rating_avg.toFixed(1)} (${shop.rating_count})`
}
