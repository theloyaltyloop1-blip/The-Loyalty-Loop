import { Platform } from 'react-native'
import Storage from 'expo-sqlite/kv-store'
import { ExtensionStorage } from '@bacons/apple-targets'

export const SHOPPER_WIDGET_NAME = 'ShopperLoyaltyWidget'
export const SHOPPER_WIDGET_STORAGE_KEY = 'loyalty-loop:shopper-widget'
const IOS_APP_GROUP = 'group.com.theloyaltyloop.shopper'

export type ShopperWidgetState = {
  shopName: string
  current: number
  target: number
  // Whole pounds at spend shops (ARCH_PLAN.md §4.11). The iOS widget prints
  // "current / target unit", so 'pounds' reads correctly without a native change.
  unit: 'stamps' | 'points' | 'visits' | 'pounds'
  remaining: number
  brandColor: string
  updatedAt: string
}

type MembershipLike = { business_id: string; stamp_count?: number | null; points_balance?: number | null; visit_count?: number | null; reward_progress_pence?: number | null }
type BusinessLike = { id: string; name: string; brand_color?: string | null; loyalty_type?: string | null; loyalty_config?: { stamps_required?: number } | null; reward_model?: string | null; reward_threshold_pence?: number | null }

export async function readShopperWidgetState(): Promise<ShopperWidgetState | null> {
  const raw = await Storage.getItem(SHOPPER_WIDGET_STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as ShopperWidgetState
  } catch {
    return null
  }
}

export async function syncShopperWidget(businesses: BusinessLike[], memberships: MembershipLike[]) {
  const membershipByBusiness = new Map(memberships.map((membership) => [membership.business_id, membership]))
  const candidates = businesses
    .map((business) => {
      const membership = membershipByBusiness.get(business.id)
      if (!membership) return null
      if (business.reward_model === 'spend_threshold') {
        // reward_threshold_pence is the shop's biggest reward, where a new round starts.
        const progress = Math.max(0, membership.reward_progress_pence || 0)
        const targetPence = Math.max(100, business.reward_threshold_pence || 2000)
        return {
          shopName: business.name,
          current: Math.floor(progress / 100),
          target: Math.ceil(targetPence / 100),
          unit: 'pounds',
          remaining: Math.ceil(Math.max(0, targetPence - progress) / 100),
          brandColor: business.brand_color || '#EF7136',
          updatedAt: new Date().toISOString(),
        } satisfies ShopperWidgetState
      }
      const unit = business.loyalty_type === 'points' ? 'points' : business.loyalty_type === 'tiered' ? 'visits' : 'stamps'
      const current = unit === 'points' ? membership.points_balance || 0 : unit === 'visits' ? membership.visit_count || 0 : membership.stamp_count || 0
      const target = Math.max(1, business.loyalty_config?.stamps_required || 10)
      return {
        shopName: business.name,
        current,
        target,
        unit,
        remaining: Math.max(0, target - current),
        brandColor: business.brand_color || '#EF7136',
        updatedAt: new Date().toISOString(),
      } satisfies ShopperWidgetState
    })
    .filter((candidate): candidate is ShopperWidgetState => Boolean(candidate))
    .sort((a, b) => a.remaining - b.remaining || b.current - a.current)

  const state = candidates[0] || {
    shopName: 'The Loyalty Loop',
    current: 0,
    target: 20,
    unit: 'pounds' as const,
    remaining: 20,
    brandColor: '#EF7136',
    updatedAt: new Date().toISOString(),
  }

  await Storage.setItem(SHOPPER_WIDGET_STORAGE_KEY, JSON.stringify(state))

  if (Platform.OS === 'ios') {
    const storage = new ExtensionStorage(IOS_APP_GROUP)
    storage.set(SHOPPER_WIDGET_STORAGE_KEY, state)
    ExtensionStorage.reloadWidget(SHOPPER_WIDGET_NAME)
    return
  }

  if (Platform.OS === 'android') {
    const { requestWidgetUpdate } = require('react-native-android-widget') as typeof import('react-native-android-widget')
    const { renderShopperWidget } = require('./android') as typeof import('./android')
    await requestWidgetUpdate({
      widgetName: SHOPPER_WIDGET_NAME,
      renderWidget: () => renderShopperWidget(state),
    })
  }
}
