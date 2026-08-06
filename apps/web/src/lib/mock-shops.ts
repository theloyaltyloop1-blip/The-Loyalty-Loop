// Placeholder shop data — will be replaced by real `businesses` rows once
// browse/discover (§2) is built.
export interface MockShop {
  name: string
  category: string
}

export const TRENDING_SHOPS: MockShop[] = [
  { name: 'Joice Cafe', category: 'CAFE' },
  { name: 'Joice Cafe', category: 'CAFE' },
  { name: 'Joice Cafe', category: 'CAFE' },
]

export const NEARBY_SHOPS: MockShop[] = [
  { name: 'Joice Cafe', category: 'CAFE' },
  { name: 'Joice Cafe', category: 'CAFE' },
  { name: 'Joice Cafe', category: 'CAFE' },
]

export const ALL_SHOPS: MockShop[] = [...TRENDING_SHOPS, ...NEARBY_SHOPS]
