import { useState } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'
import { CardRail, NextRewardHero } from './HomeCollection'
import { QuickCardsSheet } from './QuickCardsSheet'
import { FadeUp, INK, MUTED, PACIFIC, PAPER, SAGE, SANS_HEAVY, SANS_MEDIUM, SAPPHIRE, SLATE } from './Poster'
import { formatMiles, nearestFirst, type Coords } from '../distance'
import type { HomeMember, HomeShop, HomeTier } from '../home-progress'
import type { LocationStatus } from '../use-user-location'

// Shopper home, rebuilt 2026-11-04: one column, one rhythm. Greeting, the
// next reward, your cards, a short list of shops near you, one piece of news,
// then a quiet "ask a shop" line. Search and filters live behind the search
// button so the page stays calm. Every block is full width with the same
// corners and the same section heading.
const NEAR_COUNT = 4
const MARK_TONES = [
  { bg: SAGE, fg: INK },
  { bg: SLATE, fg: '#FFFFFF' },
  { bg: PACIFIC, fg: INK },
  { bg: SAPPHIRE, fg: PAPER },
]

type FeedShop = HomeShop & { lat?: number | null; lng?: number | null }
type FeedNews = { id: string; title: string; body: string | null; business: { name: string } | null }

function initialsOf(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?'
}

function Chevron() {
  return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Path d="m9 6 6 6-6 6" stroke={MUTED} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>
}

function SearchGlyph() {
  return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Circle cx={11} cy={11} r={7} stroke={INK} strokeWidth={2} /><Path d="m20 20-3.5-3.5" stroke={INK} strokeWidth={2} strokeLinecap="round" /></Svg>
}

function Heading({ title, right }: { title: string; right?: React.ReactNode }) {
  return <View style={s.headingRow}><Text accessibilityRole="header" style={s.heading}>{title}</Text>{right}</View>
}

function ShopMark({ shop, index }: { shop: FeedShop; index: number }) {
  const [failed, setFailed] = useState(false)
  const tone = MARK_TONES[index % MARK_TONES.length]
  if (shop.logo_url && !failed) {
    return <View style={[s.mark, { backgroundColor: '#FFFFFF' }]}><Image accessibilityIgnoresInvertColors source={{ uri: shop.logo_url }} style={StyleSheet.absoluteFill} resizeMode="cover" onError={() => setFailed(true)} /></View>
  }
  return <View style={[s.mark, { backgroundColor: tone.bg }]}><Text style={[s.markText, { color: tone.fg }]}>{initialsOf(shop.name)}</Text></View>
}

export function HomeFeed<T extends FeedShop>({
  firstName, shops, memberships, catalog, news, location, locationStatus, onUseLocation,
  onSelect, onSearch, onSeeNews, onAsk, onOpenProfile, quickIds = [], onQuickChange,
}: {
  firstName?: string
  shops: T[]; memberships: HomeMember[]; catalog: HomeTier[]; news: FeedNews[]
  location: Coords | null; locationStatus: LocationStatus; onUseLocation: () => void
  onSelect: (shop: T) => void; onSearch: () => void; onSeeNews: () => void; onAsk: () => void; onOpenProfile: () => void
  /** Shopper-picked cards for the top of home; empty means automatic. */
  quickIds?: string[]; onQuickChange?: (ids: string[]) => void
}) {
  const [editingQuick, setEditingQuick] = useState(false)
  const hour = new Date().getHours()
  const part = hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening'
  const name = firstName?.trim().split(/\s+/)[0]
  const joined = shops.filter(shop => memberships.some(m => m.business_id === shop.id))
  const near = (location
    ? nearestFirst(shops, location)
    : [...joined, ...shops.filter(shop => !joined.includes(shop))].map(shop => ({ shop, miles: null as number | null }))
  ).slice(0, NEAR_COUNT)
  const latest = news[0]

  return <View style={s.page}>
    <FadeUp>
      <View style={s.topRow}>
        <Text style={s.date}>{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }).toUpperCase()}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Your profile and settings" onPress={onOpenProfile} hitSlop={8} style={({ pressed }) => [s.avatar, pressed && s.pressed]}>
          <Text style={s.avatarText}>{name ? name.charAt(0).toUpperCase() : '·'}</Text>
        </Pressable>
      </View>
      <Text accessibilityRole="header" style={s.title}>{name ? `${part},\n${name}.` : `Good\n${part.toLowerCase()}.`}</Text>
    </FadeUp>

    <FadeUp delay={100}><NextRewardHero shops={shops} memberships={memberships} catalog={catalog} onSelect={onSelect} quickIds={quickIds} onEditQuick={onQuickChange ? () => setEditingQuick(true) : undefined} /></FadeUp>

    {joined.length > 0 && <FadeUp delay={180} style={s.section}>
      <Heading title="Your cards" />
      <CardRail shops={joined} memberships={memberships} catalog={catalog} onSelect={onSelect} />
    </FadeUp>}

    <FadeUp delay={260} style={s.section}>
      <Heading title={location ? 'Near you' : 'Local shops'} right={
        <Pressable accessibilityRole="button" accessibilityLabel="Search shops" onPress={onSearch} hitSlop={6} style={({ pressed }) => [s.searchButton, pressed && s.pressed]}><SearchGlyph /></Pressable>
      } />
      {!location && (locationStatus === 'ask' || locationStatus === 'denied' || locationStatus === 'unavailable') && (
        <Pressable accessibilityRole="button" onPress={onUseLocation} style={({ pressed }) => [s.locationLink, pressed && s.pressed]}>
          <Text style={s.locationText}>Show the closest first</Text>
        </Pressable>
      )}
      <View style={s.rows}>
        {near.map(({ shop, miles }, i) => (
          <Pressable key={shop.id} accessibilityRole="button" accessibilityLabel={`${shop.name}${shop.category ? `, ${shop.category}` : ''}${miles !== null ? `, ${formatMiles(miles)} away` : ''}`} onPress={() => onSelect(shop)} style={({ pressed }) => [s.row, pressed && s.pressed]}>
            <ShopMark shop={shop} index={i} />
            <View style={s.rowCopy}>
              <Text style={s.rowName} numberOfLines={1}>{shop.name}</Text>
              <Text style={s.rowMeta} numberOfLines={1}>{[shop.category || 'Local independent', miles !== null ? formatMiles(miles) : null, memberships.some(m => m.business_id === shop.id) ? 'Your card' : null].filter(Boolean).join(' · ')}</Text>
            </View>
            <Chevron />
          </Pressable>
        ))}
      </View>
      {shops.length > near.length && (
        <Pressable accessibilityRole="button" onPress={onSearch} style={({ pressed }) => [s.outline, pressed && s.pressed]}>
          <Text style={s.outlineText}>See all {shops.length} shops</Text>
        </Pressable>
      )}
    </FadeUp>

    {latest && <FadeUp delay={340} style={s.section}>
      <Heading title="From your shops" right={news.length > 1 ? <Pressable accessibilityRole="button" onPress={onSeeNews} hitSlop={8}><Text style={s.link}>More</Text></Pressable> : undefined} />
      <View style={s.news}>
        <Text style={s.newsFrom} numberOfLines={1}>{latest.business?.name || 'The Loyalty Loop'}</Text>
        <Text style={s.newsTitle}>{latest.title}</Text>
        {!!latest.body && <Text style={s.newsBody} numberOfLines={3}>{latest.body}</Text>}
      </View>
    </FadeUp>}

    <Pressable accessibilityRole="button" onPress={onAsk} style={({ pressed }) => [s.ask, pressed && s.pressed]}>
      <Text style={s.askText}>Can’t find your favourite shop? <Text style={s.askLink}>Ask them to join</Text></Text>
    </Pressable>

    {onQuickChange && <QuickCardsSheet visible={editingQuick} onClose={() => setEditingQuick(false)} shops={joined} memberships={memberships} catalog={catalog} selected={quickIds} onChange={onQuickChange} />}
  </View>
}

const CARD = '#FFFFFF'
const s = StyleSheet.create({
  page: { paddingTop: 8 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  date: { fontSize: 11, fontWeight: '500', letterSpacing: 1.8, color: MUTED },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: SAPPHIRE, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: PAPER, fontSize: 16, fontWeight: '700' },
  title: { marginTop: 14, marginBottom: 24, fontFamily: SANS_HEAVY, fontSize: 46, lineHeight: 47, letterSpacing: -2.4, color: INK },
  section: { marginTop: 12, marginBottom: 24 },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 40, marginBottom: 12 },
  heading: { fontSize: 20, fontWeight: '700', letterSpacing: -0.6, color: INK },
  link: { color: SAPPHIRE, fontSize: 14, fontFamily: SANS_MEDIUM },
  searchButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: CARD, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(26,33,56,0.2)', alignItems: 'center', justifyContent: 'center' },
  locationLink: { alignSelf: 'flex-start', marginTop: -4, marginBottom: 12 },
  locationText: { color: SAPPHIRE, fontSize: 14, fontFamily: SANS_MEDIUM },
  rows: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: CARD, borderRadius: 22, padding: 10, paddingRight: 16 },
  mark: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  markText: { fontSize: 18, fontWeight: '700' },
  rowCopy: { flex: 1, minWidth: 0, gap: 3 },
  rowName: { fontSize: 16, fontWeight: '600', letterSpacing: -0.3, color: INK },
  rowMeta: { fontSize: 13, color: MUTED },
  outline: { marginTop: 12, height: 48, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(26,33,56,0.25)', alignItems: 'center', justifyContent: 'center' },
  outlineText: { color: INK, fontSize: 14, fontFamily: SANS_MEDIUM },
  news: { backgroundColor: CARD, borderRadius: 22, padding: 18, gap: 6 },
  newsFrom: { fontSize: 11, fontWeight: '500', letterSpacing: 1.6, textTransform: 'uppercase', color: MUTED },
  newsTitle: { fontSize: 17, fontWeight: '600', letterSpacing: -0.3, color: INK },
  newsBody: { fontSize: 14, lineHeight: 21, color: MUTED },
  ask: { alignSelf: 'center', paddingVertical: 14, marginBottom: 8 },
  askText: { fontSize: 14, color: MUTED, textAlign: 'center' },
  askLink: { color: SAPPHIRE, fontWeight: '600' },
  pressed: { opacity: 0.8 },
})
