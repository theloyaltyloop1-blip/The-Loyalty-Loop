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

export type RewardWords = {
  /** Singular noun for one unit of progress: "stamp", "visit". */
  unit: string
  units: string
  /** Heading word for the programme: "Stamp card", "Membership". */
  programme: string
  /** Label for the owner's threshold field. */
  thresholdLabel: string
  /** What a customer sees as progress, e.g. "2 more stamps until a reward". */
  remaining: (n: number) => string
}

const plural = (n: number, unit: string, units: string) => (n === 1 ? unit : units)

export function rewardWords(type: LoyaltyType | null | undefined): RewardWords {
  if (type === 'points') {
    return {
      unit: 'point', units: 'points', programme: 'Points',
      thresholdLabel: 'Points needed for a reward',
      remaining: (n) => `${n} more ${plural(n, 'point', 'points')} until a reward`,
    }
  }
  if (type === 'tiered') {
    return {
      unit: 'visit', units: 'visits', programme: 'Membership',
      thresholdLabel: 'Visits to reach the next level',
      remaining: (n) => `${n} more ${plural(n, 'visit', 'visits')} to reach the next level`,
    }
  }
  return {
    unit: 'stamp', units: 'stamps', programme: 'Stamp card',
    thresholdLabel: 'Stamps needed for a reward',
    remaining: (n) => `${n} more ${plural(n, 'stamp', 'stamps')} until a reward`,
  }
}
