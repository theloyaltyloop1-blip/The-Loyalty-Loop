import type { Business } from '@/lib/businesses'

export type LoyaltyType = Business['loyalty_type']

export type ShopTypeKey = 'everyday' | 'style' | 'premium'

export type ShopType = {
  key: ShopTypeKey
  title: string
  examples: string
  blurb: string
  loyalty_type: LoyaltyType
  /** Category pre-selected when the owner picks this shop type. */
  category: string
}

// Premium shops map to 'tiered' until the VIP-list reward type exists.
export const SHOP_TYPES: ShopType[] = [
  { key: 'everyday', title: 'Café, bakery or barber', examples: 'Regulars popping in often', blurb: 'Customers collect stamps towards a free treat.', loyalty_type: 'stamp_card', category: 'Café' },
  { key: 'style', title: 'Boutique, jeweller, salon or homeware', examples: 'Fewer, bigger visits', blurb: 'Customers earn member levels the more they visit.', loyalty_type: 'tiered', category: 'Retail' },
  { key: 'premium', title: 'Premium or one-off purchases', examples: 'Recognition over freebies', blurb: 'A members list with levels and special perks.', loyalty_type: 'tiered', category: 'Retail' },
]

// Wording for each reward type lives in @loyalty-loop/loyalty, shared with the apps.
export { rewardWords } from '@loyalty-loop/loyalty'
export type { RewardWords } from '@loyalty-loop/loyalty'
