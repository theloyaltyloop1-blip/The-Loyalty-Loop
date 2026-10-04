import { useState } from 'react'
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'
import { colors as c, fonts } from '@loyalty-loop/design-tokens'
import { homeProgress, type HomeShop, type HomeMember, type HomeTier } from '../home-progress'
import { formatMiles, nearestFirst, pickFeatured, type Coords } from '../distance'
import type { LocationStatus } from '../use-user-location'

// Only the closest shops get a photo card, in a row you swipe. The rest wait behind a button, as quiet rows.
const PHOTO_CARDS = 6
const ROWS_PER_TAP = 8
const RAIL_GAP = 12

function Arrow({ color = c.foreground }: { color?: string }) {
  return <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"><Path d="M5 12h14m-6-6 6 6-6 6" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>
}

function Pin({ color = c.primary, size = 14 }: { color?: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /><Circle cx={12} cy={10} r={3} stroke={color} strokeWidth={2} /></Svg>
}

function LocationNote({ status, onUseLocation }: { status: LocationStatus; onUseLocation: () => void }) {
  if (status === 'ask' || status === 'unavailable') return <Pressable accessibilityRole="button" onPress={onUseLocation} style={({ pressed }) => [s.locationButton, pressed && s.pressed]}><Pin /><Text style={s.locationButtonText}>{status === 'ask' ? 'Show closest first' : 'Couldn\u2019t find you. Try again'}</Text></Pressable>
  if (status === 'locating') return <Text accessibilityLiveRegion="polite" style={s.locationText}>Finding the closest shops\u2026</Text>
  if (status === 'ready') return <View style={s.locationReady}><Pin /><Text style={s.locationReadyText}>Closest first</Text></View>
  if (status === 'denied') return <Pressable accessibilityRole="button" onPress={() => { void Linking.openSettings() }} style={({ pressed }) => [s.locationButton, pressed && s.pressed]}><Pin /><Text style={s.locationButtonText}>Turn on location for closest first</Text></Pressable>
  return null
}

function ShopMark({ shop }: { shop: HomeShop }) {
  const [failed, setFailed] = useState(false)
  return <View style={s.mark}>{shop.logo_url && !failed
    ? <Image accessibilityIgnoresInvertColors source={{ uri: shop.logo_url }} style={StyleSheet.absoluteFill} resizeMode="contain" onError={() => setFailed(true)} />
    : <Text style={s.markInitial}>{shop.name.trim().charAt(0).toUpperCase()}</Text>}</View>
}

function ShopPhoto({ shop, large = false, distance }: { shop: HomeShop; large?: boolean; distance?: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const url = shop.cover_url || shop.logo_url
  return <View style={[s.photo, large && s.largePhoto]}>
    {url && failedUrl !== url
      ? <Image accessibilityIgnoresInvertColors source={{ uri: url }} style={StyleSheet.absoluteFill} resizeMode={shop.cover_url ? 'cover' : 'contain'} onError={() => setFailedUrl(url)} />
      : <View style={s.photoFallback}><Text style={s.initial}>{shop.name.trim().charAt(0).toUpperCase()}</Text><Text style={s.fallbackCategory}>{shop.category || 'Local independent'}</Text></View>}
    {distance && <View style={s.distancePill}><Pin size={12} /><Text style={s.distanceText}>{distance}</Text></View>}
  </View>
}

export function HomeCollection<T extends HomeShop & { lat?: number | null; lng?: number | null }>({ shops, featured, memberships, catalog, filtered, onSelect, location, locationStatus, onUseLocation }: {
  shops: T[]; featured: T[]; memberships: HomeMember[]; catalog: HomeTier[]; filtered: boolean; onSelect: (shop: T) => void;
  location: Coords | null; locationStatus: LocationStatus; onUseLocation: () => void;
}) {
  const [allCards, setAllCards] = useState(false)
  const [moreRows, setMoreRows] = useState(0)
  const { width } = useWindowDimensions()
  // Two cards' worth of screen is calm; a card a bit wider than half the screen shows the next one peeking in.
  const railCard = Math.min(300, Math.round((width - 40) * 0.72))
  // Top card: the shop you visit most, else the closest to you, else the admin's Trending pick.
  const personal = pickFeatured(shops, memberships, location)
  const hero = personal?.shop ?? featured.find(shop => shop.cover_url) ?? featured[0] ?? shops[0]
  const heroMiles = hero && location ? nearestFirst([hero], location)[0].miles : null
  const heroLabel = personal?.reason === 'visited' ? 'Your most visited' : personal?.reason === 'closest' && heroMiles !== null ? `Closest to you \u00b7 ${formatMiles(heroMiles)}` : undefined
  // The shop in the big card at the top isn't repeated in the list of your cards.
  const joined = shops.filter(shop => shop.id !== hero?.id && memberships.some(member => member.business_id === shop.id))
  const remaining = shops.filter(shop => shop.id !== hero?.id)
  const ranked = location ? nearestFirst(remaining, location) : remaining.map(shop => ({ shop, miles: null as number | null }))
  const nearby = ranked.slice(0, PHOTO_CARDS)
  const rest = ranked.slice(PHOTO_CARDS)
  const hiddenRows = Math.max(0, rest.length - moreRows)
  const nextBatch = Math.min(ROWS_PER_TAP, hiddenRows)
  const label = (shop: T, miles: number | null) => `Explore ${shop.name}${shop.category ? `, ${shop.category}` : ''}${miles !== null ? `, ${formatMiles(miles)} away` : ''}`
  const openStyle = ({ pressed }: { pressed: boolean }) => [pressed && s.pressed]
  return <>
    {hero && <Pressable accessibilityRole="button" accessibilityLabel={`Explore ${hero.name}. ${homeProgress(hero, undefined, catalog).offer}`} onPress={() => onSelect(hero)} style={({ pressed }) => [s.hero, ...openStyle({ pressed })]}>
      <ShopPhoto key={hero.id} shop={hero} large distance={heroLabel} />
      <View style={s.heroCopy}>
        <Text style={s.heroName}>{hero.name}</Text>
        <Text style={s.heroDescription} numberOfLines={2}>{hero.description || hero.category || 'Discover a local favourite'}</Text>
        <View style={s.offer}><Text style={s.offerText}>{homeProgress(hero, undefined, catalog).offer}</Text><Arrow /></View>
      </View>
    </Pressable>}

    {joined.length > 0 && <View style={s.section}>
      <Text style={s.heading}>Your regulars. Your rewards.</Text>
      <View style={s.wallet}>
        {(allCards ? joined : joined.slice(0, 3)).map((shop, index) => {
          const progress = homeProgress(shop, memberships.find(m => m.business_id === shop.id), catalog)
          const dark = index % 3 === 0
          const ink = dark ? c.oliveInk : index % 3 === 1 ? c.peachInk : c.sageInk
          const backgroundColor = dark ? c.olive : index % 3 === 1 ? c.peach : c.sage
          return <Pressable key={shop.id} accessibilityRole="button" accessibilityLabel={`${shop.name}. ${progress.label}. View your card`} onPress={() => onSelect(shop)} style={({ pressed }) => [s.loyaltyCard, { backgroundColor }, pressed && s.pressed]}>
            <Text style={[s.cardName, { color: ink }]}>{shop.name}</Text>
            <Text style={[s.cardReward, { color: ink }]}>{progress.title || 'Your loyalty card'}</Text>
            {!progress.spend && progress.unit !== 'points' && progress.threshold && progress.threshold <= 12
              ? <View style={s.stamps} accessible accessibilityLabel={progress.label}>{Array.from({ length: progress.threshold }, (_, i) => <View key={i} style={[s.stamp, { borderColor: ink, backgroundColor: i < progress.value ? ink : 'transparent' }]}>{i < progress.value && <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"><Path d="m5 12 4 4 10-10" stroke={backgroundColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>}</View>)}</View>
              : progress.threshold ? <View style={[s.progressTrack, { backgroundColor: dark ? '#617257' : '#C5BBA9' }]} accessible accessibilityRole="progressbar" accessibilityLabel={progress.label} accessibilityValue={{ min: 0, max: progress.threshold, now: Math.min(progress.value, progress.threshold), text: progress.label }}><View style={[s.progressFill, { backgroundColor: ink, width: `${progress.fraction * 100}%` }]} /></View> : null}
            <View style={s.cardFooter}><Text style={[s.cardCount, { color: ink }]}>{progress.label}</Text><View style={[s.viewCard, { backgroundColor: dark ? c.oliveInk : c.primary }]}><Text style={[s.viewCardText, { color: dark ? c.olive : '#FFFFFF' }]}>View card</Text><Arrow color={dark ? c.olive : '#FFFFFF'} /></View></View>
          </Pressable>
        })}
      </View>
      {joined.length > 3 && <Pressable accessibilityRole="button" onPress={() => setAllCards(!allCards)} style={s.more}><Text style={s.moreText}>{allCards ? 'Show fewer cards' : `See all ${joined.length} cards`}</Text><Arrow color={c.primary} /></Pressable>}
    </View>}

    {remaining.length > 0 && <View style={s.section}>
      <View style={s.headingRow}>
        <Text style={[s.heading, s.headingInRow]}>{filtered ? 'More matching shops' : 'Find your next favourite'}</Text>
        <LocationNote status={locationStatus} onUseLocation={onUseLocation} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="fast" snapToInterval={railCard + RAIL_GAP} snapToAlignment="start" style={s.rail} contentContainerStyle={s.railContent}>
        {nearby.map(({ shop, miles }) => <Pressable accessibilityRole="button" accessibilityLabel={label(shop, miles)} key={shop.id} onPress={() => onSelect(shop)} style={({ pressed }) => [s.tile, { width: railCard }, pressed && s.pressed]}>
          <ShopPhoto shop={shop} distance={miles !== null ? formatMiles(miles) : undefined} /><View style={s.tileCopy}><Text style={s.tileName} numberOfLines={2}>{shop.name}</Text><Text style={s.tileCategory} numberOfLines={2}>{shop.category || 'Local independent'}</Text><View style={s.tileAction}><Text style={s.tileActionText}>Explore shop</Text><Arrow color={c.primary} /></View></View>
        </Pressable>)}
      </ScrollView>
      {moreRows > 0 && <View style={s.rows}>{rest.slice(0, moreRows).map(({ shop, miles }) => <Pressable accessibilityRole="button" accessibilityLabel={label(shop, miles)} key={shop.id} onPress={() => onSelect(shop)} style={({ pressed }) => [s.row, pressed && s.pressed]}>
        <ShopMark shop={shop} /><View style={s.rowCopy}><Text style={s.rowName} numberOfLines={1}>{shop.name}</Text><Text style={s.rowMeta} numberOfLines={1}>{[shop.category || 'Local independent', miles !== null ? formatMiles(miles) : null].filter(Boolean).join(' \u00b7 ')}</Text></View><Arrow color={c.primary} />
      </Pressable>)}</View>}
      {hiddenRows > 0 && <Pressable accessibilityRole="button" onPress={() => setMoreRows(count => count + ROWS_PER_TAP)} style={({ pressed }) => [s.showMore, pressed && s.pressed]}><Text style={s.moreText}>{`Show ${nextBatch} more ${nextBatch === 1 ? 'shop' : 'shops'}`}</Text><Arrow color={c.primary} /></Pressable>}
    </View>}
    {!shops.length && <View style={s.empty}><Text style={s.heading}>{filtered ? 'No shops found' : 'Local favourites are on their way'}</Text><Text style={s.emptyText}>{filtered ? 'Try another name or category, or ask your favourite shop to join below.' : 'Pull down to refresh, or ask a shop to join below.'}</Text></View>}
  </>
}

export const homeStyles = StyleSheet.create({
  title: { fontFamily: fonts.nativeDisplay, fontSize: 42, lineHeight: 46, letterSpacing: -1, color: c.foreground, marginTop: 6, marginBottom: 20 },
  sectionHeading: { fontFamily: fonts.nativeDisplaySemibold, fontSize: 23, color: c.foreground, marginTop: 32, marginBottom: 14 },
})
const s = StyleSheet.create({
  pressed: { opacity: 0.78 },
  hero: { borderRadius: 22, overflow: 'hidden', backgroundColor: c.olive, marginTop: 4 },
  photo: { height: 142, backgroundColor: c.sage, overflow: 'hidden' },
  largePhoto: { height: 246 },
  photoFallback: { flex: 1, padding: 20, justifyContent: 'center', alignItems: 'center' },
  initial: { fontFamily: fonts.nativeDisplay, fontSize: 64, color: c.olive },
  fallbackCategory: { fontSize: 13, color: c.sageInk, textAlign: 'center' },
  heroCopy: { padding: 18, gap: 8 },
  heroName: { fontFamily: fonts.nativeDisplay, fontSize: 29, color: c.oliveInk, letterSpacing: -0.6 },
  heroDescription: { fontSize: 15, lineHeight: 21, color: c.oliveInk },
  offer: { marginTop: 8, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 24, backgroundColor: c.sage, flexDirection: 'row', alignItems: 'center', gap: 12 },
  offerText: { flex: 1, fontSize: 14, fontWeight: '600', color: c.sageInk },
  section: { marginTop: 30 },
  heading: { fontFamily: fonts.nativeDisplaySemibold, fontSize: 23, color: c.foreground, letterSpacing: -0.4, marginBottom: 14 },
  wallet: { gap: 12 },
  loyaltyCard: { padding: 20, borderRadius: 20, gap: 8 },
  cardName: { fontFamily: fonts.nativeDisplay, fontSize: 25, letterSpacing: -0.5 },
  cardReward: { fontSize: 15, lineHeight: 21 },
  stamps: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, marginBottom: 8 },
  stamp: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden', marginVertical: 12 },
  progressFill: { height: 8, borderRadius: 4 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', marginTop: 4 },
  cardCount: { fontSize: 14, fontWeight: '500' },
  viewCard: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, minHeight: 48 },
  viewCardText: { fontSize: 14, fontWeight: '700' },
  more: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, marginTop: 8 },
  moreText: { color: c.primary, fontSize: 15, fontWeight: '600' },
  headingRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', columnGap: 12, rowGap: 8, marginBottom: 14 },
  headingInRow: { marginBottom: 0 },
  locationButton: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 14, borderRadius: 22, backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
  locationButtonText: { color: c.foreground, fontSize: 14, fontWeight: '600' },
  locationText: { color: c.muted, fontSize: 14 },
  locationReady: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  locationReadyText: { color: c.muted, fontSize: 14, fontWeight: '600' },
  rail: { marginHorizontal: -20 },
  railContent: { paddingHorizontal: 20, gap: RAIL_GAP, paddingBottom: 4 },
  tile: { backgroundColor: c.card, borderRadius: 18, overflow: 'hidden' },
  distancePill: { position: 'absolute', left: 10, top: 10, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 14, backgroundColor: 'rgba(252,252,250,0.95)' },
  distanceText: { color: c.foreground, fontSize: 12, fontWeight: '600' },
  rows: { gap: 8, marginTop: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 16, backgroundColor: c.card },
  mark: { width: 44, height: 44, borderRadius: 12, backgroundColor: c.olive, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  markInitial: { fontFamily: fonts.nativeDisplay, fontSize: 19, color: c.oliveInk },
  rowCopy: { flex: 1, gap: 2 },
  rowName: { fontFamily: fonts.nativeDisplaySemibold, fontSize: 16, color: c.foreground },
  rowMeta: { fontSize: 13, color: c.muted },
  showMore: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 10, minHeight: 48, marginTop: 14, paddingHorizontal: 18, borderRadius: 24, backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
  tileCopy: { padding: 14, gap: 5 },
  tileName: { fontFamily: fonts.nativeDisplaySemibold, fontSize: 18, color: c.foreground },
  tileCategory: { fontSize: 13, lineHeight: 18, color: c.muted },
  tileAction: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  tileActionText: { color: c.primary, fontSize: 13, fontWeight: '600' },
  empty: { paddingVertical: 24 },
  emptyText: { color: c.muted, fontSize: 16, lineHeight: 24 },
})
