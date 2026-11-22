import { View } from 'react-native'
import { LoyaltyCard } from '../../../../packages/card-design/LoyaltyCard'
import { homeProgress, type HomeShop, type HomeMember, type HomeTier } from '../home-progress'
import { shopMoney } from '../money'

// The card a shop designed in the Business app, drawn at one fixed size so the Home tile,
// the top of the shop page and the grow/shrink animation are the same picture.
export const FACE_W = 300
export const FACE_H = 240

type DesignedShop = HomeShop & { card_design?: unknown }

export const hasDesign = (shop: { card_design?: unknown }) => !!shop.card_design

/** What the card says, from the shopper's real progress. */
export function faceProps(shop: DesignedShop, member: HomeMember | undefined, catalog: HomeTier[]) {
  const p = homeProgress(shop, member, catalog, shopMoney(shop.country_code))
  const money = (v: number) => shopMoney(shop.country_code)(v).replace(/\.00$/, '')
  const stamps = !p.spend && p.unit !== 'points' && p.threshold != null && p.threshold > 0 && p.threshold <= 20
  if (stamps) {
    const n = Math.min(p.value, p.threshold!)
    return { value: n, target: p.threshold!, stamps, label: `${n} of ${p.threshold} stamps`, reward: p.title || p.offer || '' }
  }
  const label = p.threshold == null ? p.label : p.spend ? `${money(p.value)} of ${money(p.threshold)}` : `${p.value} of ${p.threshold} ${p.unit === 'points' ? 'points' : ''}`.trim()
  return { value: Math.round(p.fraction * 100), target: 100, stamps: false, label, reward: p.title || p.offer || '' }
}

/** The designed card at its fixed size. */
export function DesignedCard({ shop, member, catalog }: { shop: DesignedShop; member?: HomeMember; catalog: HomeTier[] }) {
  const f = faceProps(shop, member, catalog)
  return <LoyaltyCard shop={shop} value={f.value} target={f.target} stamps={f.stamps} label={f.label} reward={f.reward || ' '} />
}

/** The same card, shrunk to `width` as a true miniature (the whole card, not a crop). */
export function DesignedCardMini({ shop, member, catalog, width }: { shop: DesignedShop; member?: HomeMember; catalog: HomeTier[]; width: number }) {
  const k = width / FACE_W
  return <View pointerEvents="none" style={{ width, height: FACE_H * k, overflow: 'hidden', borderRadius: 24 * k }}>
    <View style={{ width: FACE_W, height: FACE_H, transform: [{ scale: k }], transformOrigin: 'top left' }}>
      <DesignedCard shop={shop} member={member} catalog={catalog} />
    </View>
  </View>
}
