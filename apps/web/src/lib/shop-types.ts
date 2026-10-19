// What kind of shop an owner runs decides the recommended programme. The list
// itself lives in @loyalty-loop/loyalty so the Business app asks the same thing.
export { SHOP_KINDS as SHOP_TYPES } from '@loyalty-loop/loyalty'
export type { ShopKind as ShopType, ShopKindKey as ShopTypeKey } from '@loyalty-loop/loyalty'

// Wording for each reward type lives in @loyalty-loop/loyalty, shared with the apps.
export { rewardWords } from '@loyalty-loop/loyalty'
export type { RewardWords } from '@loyalty-loop/loyalty'

export type LoyaltyType = 'stamp_card' | 'points' | 'tiered'
