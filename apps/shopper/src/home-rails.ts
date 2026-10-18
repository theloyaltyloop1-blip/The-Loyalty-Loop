// Decides which swipeable rows the home screen shows, in the style of the
// delivery apps: a few hand-picked rails, then a row per popular category.
// Pure logic, no React, so it can be tested on its own (home-rails.test.cjs).
type Shop = { id: string; category?: string | null; created_at?: string | null }

export type CategoryRail<T> = { category: string; shops: T[] }

// Categories with at least `min` shops, biggest first, each limited to `per` shops.
export function categoryRails<T extends Shop>(shops: T[], { max = 4, min = 2, per = 10 } = {}): CategoryRail<T>[] {
  const groups = new Map<string, T[]>()
  for (const shop of shops) {
    const key = shop.category?.trim() || 'Other'
    groups.set(key, [...(groups.get(key) ?? []), shop])
  }
  return [...groups.entries()]
    .filter(([category, list]) => category !== 'Other' && list.length >= min)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([category, list]) => ({ category, shops: list.slice(0, per) }))
}

// Newest shops first. Only worth a row when there are enough shops overall
// that "new" means something; shops without a date are left out.
export function newestShops<T extends Shop>(shops: T[], { limit = 8, minTotal = 6 } = {}): T[] {
  if (shops.length < minTotal) return []
  return shops
    .filter(shop => Date.parse(shop.created_at ?? '') > 0)
    .sort((a, b) => Date.parse(b.created_at!) - Date.parse(a.created_at!))
    .slice(0, limit)
}

// Category chips across the top: every category, biggest first.
export function categoryCounts<T extends Shop>(shops: T[]): [string, number][] {
  const counts = new Map<string, number>()
  for (const shop of shops) {
    const key = shop.category?.trim() || 'Other'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

// Hero carousel: the personal pick first, then other featured shops with a
// photo, without repeats, up to `limit` slides.
export function heroSlides<T extends { id: string; cover_url?: string | null }>(personal: T | undefined, featured: T[], fallback: T[], limit = 5): T[] {
  const out: T[] = []
  const add = (shop: T | undefined) => { if (shop && !out.some(s => s.id === shop.id) && out.length < limit) out.push(shop) }
  add(personal)
  featured.filter(shop => shop.cover_url).forEach(add)
  featured.forEach(add)
  if (!out.length) add(fallback[0])
  return out
}
