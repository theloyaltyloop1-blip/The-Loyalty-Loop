import { progressFor } from '@loyalty-loop/loyalty'

export type HomeShop = {
  id: string; name: string; category?: string | null; description?: string | null;
  address?: string | null; logo_url?: string | null; cover_url?: string | null; brand_color?: string | null;
  loyalty_type?: string; loyalty_config?: { stamps_required?: number };
  reward_model?: 'stamp_legacy' | 'spend_threshold' | 'tiers' | 'points'; reward_threshold_pence?: number | null;
  country_code?: string | null;
  rating_avg?: number | null; rating_count?: number | null;
}
export type HomeMember = { business_id: string; stamp_count: number; points_balance: number; reward_progress_pence?: number | null; visit_count?: number | null; last_activity_at?: string | null }
export type HomeTier = { business_id: string; title: string; stamp_threshold: number; spend_threshold_pence?: number | null }
const pounds = (value: number) => `£${(value / 100).toFixed(2)}`

// The calculation lives in @loyalty-loop/loyalty and is shared with the website.
// Never invents a reward target when the catalogue is unavailable.
// `money` formats minor units in the shop's currency; it defaults to pounds.
export function homeProgress(shop: HomeShop, member: HomeMember | undefined, catalog: HomeTier[], money: (value: number) => string = pounds) {
  const { value, threshold, unit, spend, title, label, offer, fraction } = progressFor(shop, member, catalog, money)
  return { value, threshold, unit, spend, title, label, offer, fraction }
}
