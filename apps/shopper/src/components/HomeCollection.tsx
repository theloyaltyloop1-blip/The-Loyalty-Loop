import { useState, type ReactNode } from 'react'
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'
import { colors as c, fonts } from '@loyalty-loop/design-tokens'
import { homeProgress, type HomeShop, type HomeMember, type HomeTier } from '../home-progress'
import { formatMiles, nearestFirst, pickFeatured, type Coords } from '../distance'
import { categoryRails, heroSlides, newestShops } from '../home-rails'
import type { LocationStatus } from '../use-user-location'

// Home screen in delivery-app style: a hero carousel, then rows you swipe sideways.
const ROWS_PER_TAP = 8
const RAIL_GAP = 12

type RailShop = HomeShop & { lat?: number | null; lng?: number | null; created_at?: string | null }

function Arrow({ color = c.foreground }: { color?: string }) {
  return <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"><Path d="M5 12h14m-6-6 6 6-6 6" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>
}

function Pin({ color = c.primary, size = 14 }: { color?: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /><Circle cx={12} cy={10} r={3} stroke={color} strokeWidth={2} /></Svg>
}

function LocationNote({ status, onUseLocation }: { status: LocationStatus; onUseLocation: () => void }) {
  if (status === 'ask' || status === 'unavailable') return <Pressable accessibilityRole="button" onPress={onUseLocation} style={({ pressed }) => [s.locationButton, pressed && s.pressed]}><Pin /><Text style={s.locationButtonText}>{status === 'ask' ? 'Show closest first' : 'Couldn’t find you. Try again'}</Text></Pressable>
  if (status === 'locating') return <Text accessibilityLiveRegion="polite" style={s.locationText}>Finding the closest shops{'…'}</Text>
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

const shopLabel = (shop: HomeShop, miles: number | null) => `Explore ${shop.name}${shop.category ? `, ${shop.category}` : ''}${miles !== null ? `, ${formatMiles(miles)} away` : ''}`

// Full-width slides you swipe between, with dots underneath, like the banners in delivery apps.
function HeroCarousel<T extends RailShop>({ slides, label, catalog, onSelect }: { slides: T[]; label: (shop: T) => string | undefined; catalog: HomeTier[]; onSelect: (shop: T) => void }) {
  const { width } = useWindowDimensions()
  const [page, setPage] = useState(0)
  const slide = width - 40
  if (!slides.length) return null
  return <View>
    <ScrollView horizontal snapToInterval={slide + RAIL_GAP} snapToAlignment="start" decelerationRate="fast" showsHorizontalScrollIndicator={false} style={s.rail} contentContainerStyle={s.railContent}
      onMomentumScrollEnd={e => setPage(Math.round(e.nativeEvent.contentOffset.x / (slide + RAIL_GAP)))}>
      {slides.map(shop => {
        const offer = homeProgress(shop, undefined, catalog).offer
        return <Pressable key={shop.id} accessibilityRole="button" accessibilityLabel={`Explore ${shop.name}. ${offer}`} onPress={() => onSelect(shop)} style={({ pressed }) => [s.hero, { width: slide }, pressed && s.pressed]}>
          <ShopPhoto shop={shop} large distance={label(shop)} />
          <View style={s.heroCopy}>
            <Text style={s.heroName} numberOfLines={1}>{shop.name}</Text>
            <Text style={s.heroDescription} numberOfLines={2}>{shop.description || shop.category || 'Discover a local favourite'}</Text>
            <View style={s.offer}><Text style={s.offerText} numberOfLines={1}>{offer}</Text><Arrow /></View>
          </View>
        </Pressable>
      })}
    </ScrollView>
    {slides.length > 1 && <View style={s.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{slides.map((shop, i) => <View key={shop.id} style={[s.dot, i === page && s.dotActive]} />)}</View>}
  </View>
}

// Row heading, with an optional "See all" or location control on the right.
function RailHeading({ title, action, onAction, right }: { title: string; action?: string; onAction?: () => void; right?: ReactNode }) {
  return <View style={s.headingRow}>
    <Text style={[s.heading, s.headingInRow]}>{title}</Text>
    {right}
    {action && onAction && <Pressable accessibilityRole="button" accessibilityLabel={`${action}: ${title}`} onPress={onAction} hitSlop={8} style={s.seeAll}><Text style={s.moreText}>{action}</Text><Arrow color={c.primary} /></Pressable>}
  </View>
}

// A swipeable row of photo tiles.
function ShopRail<T extends RailShop>({ items, onSelect, width }: { items: { shop: T; miles: number | null }[]; onSelect: (shop: T) => void; width: number }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="fast" snapToInterval={width + RAIL_GAP} snapToAlignment="start" style={s.rail} contentContainerStyle={s.railContent}>
    {items.map(({ shop, miles }) => <Pressable accessibilityRole="button" accessibilityLabel={shopLabel(shop, miles)} key={shop.id} onPress={() => onSelect(shop)} style={({ pressed }) => [s.tile, { width }, pressed && s.pressed]}>
      <ShopPhoto shop={shop} distance={miles !== null ? formatMiles(miles) : undefined} />
      <View style={s.tileCopy}><Text style={s.tileName} numberOfLines={1}>{shop.name}</Text><Text style={s.tileCategory} numberOfLines={1}>{shop.category || 'Local independent'}</Text></View>
    </Pressable>)}
  </ScrollView>
}

const CARD_TONES = [
  { bg: c.olive, ink: c.oliveInk, track: '#617257' },
  { bg: c.peach, ink: c.peachInk, track: '#E9BDA3' },
  { bg: c.sage, ink: c.sageInk, track: '#C5D1BA' },
]

// Your loyalty cards as a swipeable row, the one closest to a reward first.
function CardRail<T extends RailShop>({ shops, memberships, catalog, onSelect }: { shops: T[]; memberships: HomeMember[]; catalog: HomeTier[]; onSelect: (shop: T) => void }) {
  const { width } = useWindowDimensions()
  const cardWidth = Math.min(280, Math.round((width - 40) * 0.78))
  const cards = shops.map(shop => ({ shop, progress: homeProgress(shop, memberships.find(m => m.business_id === shop.id), catalog) }))
    .sort((a, b) => b.progress.fraction - a.progress.fraction)
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="fast" snapToInterval={cardWidth + RAIL_GAP} snapToAlignment="start" style={s.rail} contentContainerStyle={s.railContent}>
    {cards.map(({ shop, progress }, index) => {
      const tone = CARD_TONES[index % CARD_TONES.length]
      const ready = progress.threshold !== null && progress.fraction >= 1
      return <Pressable key={shop.id} accessibilityRole="button" accessibilityLabel={`${shop.name}. ${progress.label}. View your card`} onPress={() => onSelect(shop)} style={({ pressed }) => [s.loyaltyCard, { backgroundColor: tone.bg, width: cardWidth }, pressed && s.pressed]}>
        <View style={s.cardTop}><ShopMark shop={shop} /><View style={{ flex: 1 }}><Text style={[s.cardName, { color: tone.ink }]} numberOfLines={1}>{shop.name}</Text><Text style={[s.cardReward, { color: tone.ink }]} numberOfLines={1}>{progress.title || 'Your loyalty card'}</Text></View></View>
        {progress.threshold ? <View style={[s.progressTrack, { backgroundColor: tone.track }]} accessible accessibilityRole="progressbar" accessibilityLabel={progress.label} accessibilityValue={{ min: 0, max: progress.threshold, now: Math.min(progress.value, progress.threshold), text: progress.label }}><View style={[s.progressFill, { backgroundColor: tone.ink, width: `${progress.fraction * 100}%` }]} /></View> : null}
        <View style={s.cardFooter}><Text style={[s.cardCount, { color: tone.ink }]}>{progress.label}</Text>{ready && <View style={s.readyPill}><Text style={s.readyText}>Reward ready</Text></View>}</View>
      </Pressable>
    })}
  </ScrollView>
}

// Round category buttons you swipe through, like the cuisine row in delivery apps.
const CIRCLE_TONES = [c.peach, c.sage, '#E4DCF0', '#F5E7B8', '#D6E6EE']
export function CategoryCircles({ categories, selected, onSelect }: { categories: [string, number][]; selected: string | null; onSelect: (category: string | null) => void }) {
  if (categories.length < 2) return null
  const item = (key: string | null, name: string, index: number) => {
    const active = selected === key
    return <Pressable key={key ?? '__all'} accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={key ? `${name} shops` : 'All shops'} onPress={() => onSelect(active && key ? null : key)} style={({ pressed }) => [s.circleItem, pressed && s.pressed]}>
      <View style={[s.circle, { backgroundColor: key ? CIRCLE_TONES[index % CIRCLE_TONES.length] : c.olive }, active && s.circleActive]}>
        <Text style={[s.circleLetter, !key && { color: c.oliveInk, fontSize: 18 }]}>{key ? name.trim().charAt(0).toUpperCase() : 'All'}</Text>
      </View>
      <Text style={[s.circleLabel, active && { color: c.primary }]} numberOfLines={1}>{name}</Text>
    </Pressable>
  }
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.rail} contentContainerStyle={[s.railContent, { gap: 10 }]}>
    {item(null, 'All', 0)}
    {categories.map(([name], index) => item(name, name, index))}
  </ScrollView>
}

function ShopRow<T extends RailShop>({ shop, miles, onSelect }: { shop: T; miles: number | null; onSelect: (shop: T) => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={shopLabel(shop, miles)} onPress={() => onSelect(shop)} style={({ pressed }) => [s.row, pressed && s.pressed]}>
    <ShopMark shop={shop} /><View style={s.rowCopy}><Text style={s.rowName} numberOfLines={1}>{shop.name}</Text><Text style={s.rowMeta} numberOfLines={1}>{[shop.category || 'Local independent', miles !== null ? formatMiles(miles) : null].filter(Boolean).join(' · ')}</Text></View><Arrow color={c.primary} />
  </Pressable>
}

export function HomeCollection<T extends RailShop>({ shops, featured, memberships, catalog, filtered, onSelect, onCategory, location, locationStatus, onUseLocation }: {
  shops: T[]; featured: T[]; memberships: HomeMember[]; catalog: HomeTier[]; filtered: boolean; onSelect: (shop: T) => void; onCategory: (category: string) => void;
  location: Coords | null; locationStatus: LocationStatus; onUseLocation: () => void;
}) {
  const [moreRows, setMoreRows] = useState(0)
  const { width } = useWindowDimensions()
  // Tiles a bit wider than half the screen, so the next one peeks in and invites a swipe.
  const railCard = Math.min(240, Math.round((width - 40) * 0.6))
  const ranked = (list: T[]) => location ? nearestFirst(list, location) : list.map(shop => ({ shop, miles: null as number | null }))
  const milesOf = (shop: T) => location ? nearestFirst([shop], location)[0].miles : null
  const withMiles = (list: T[]) => list.map(shop => ({ shop, miles: milesOf(shop) }))

  // Search or a category is on: one plain list of what matches, nearest first.
  if (filtered) {
    return <View style={s.section}>
      <RailHeading title={shops.length ? `${shops.length} matching ${shops.length === 1 ? 'shop' : 'shops'}` : 'No shops found'} right={<LocationNote status={locationStatus} onUseLocation={onUseLocation} />} />
      {shops.length ? <View style={s.rows}>{ranked(shops).map(({ shop, miles }) => <ShopRow key={shop.id} shop={shop} miles={miles} onSelect={onSelect} />)}</View>
        : <Text style={s.emptyText}>Try another name or category, or ask your favourite shop to join below.</Text>}
    </View>
  }
  if (!shops.length) return <View style={s.empty}><Text style={s.heading}>Local favourites are on their way</Text><Text style={s.emptyText}>Pull down to refresh, or ask a shop to join below.</Text></View>

  // Top slide: the shop you visit most, else the closest, then the admin's Trending picks.
  const personal = pickFeatured(shops, memberships, location)
  const slides = heroSlides(personal?.shop, featured, shops)
  const slideLabel = (shop: T) => {
    if (shop.id !== personal?.shop.id) return featured.some(f => f.id === shop.id) ? 'Trending' : undefined
    const miles = milesOf(shop)
    return personal.reason === 'visited' ? 'Your most visited' : miles !== null ? `Closest to you · ${formatMiles(miles)}` : undefined
  }
  const joined = shops.filter(shop => memberships.some(member => member.business_id === shop.id))
  const nearby = ranked(shops).slice(0, 10)
  const trending = featured.filter(shop => !slides.some(slide => slide.id === shop.id))
  const newest = newestShops(shops)
  const categories = categoryRails(shops)
  const all = ranked(shops)
  const hiddenRows = Math.max(0, all.length - moreRows)
  const nextBatch = Math.min(ROWS_PER_TAP, hiddenRows)

  return <>
    <HeroCarousel slides={slides} label={slideLabel} catalog={catalog} onSelect={onSelect} />

    {joined.length > 0 && <View style={s.section}>
      <RailHeading title="Your cards" />
      <CardRail shops={joined} memberships={memberships} catalog={catalog} onSelect={onSelect} />
    </View>}

    <View style={s.section}>
      <RailHeading title={location ? 'Near you' : 'Find your next favourite'} right={<LocationNote status={locationStatus} onUseLocation={onUseLocation} />} />
      <ShopRail items={nearby} onSelect={onSelect} width={railCard} />
    </View>

    {trending.length > 0 && <View style={s.section}>
      <RailHeading title="Trending on the Loop" />
      <ShopRail items={withMiles(trending)} onSelect={onSelect} width={railCard} />
    </View>}

    {newest.length > 0 && <View style={s.section}>
      <RailHeading title="New on the Loop" />
      <ShopRail items={withMiles(newest)} onSelect={onSelect} width={railCard} />
    </View>}

    {categories.map(rail => <View key={rail.category} style={s.section}>
      <RailHeading title={rail.category} action="See all" onAction={() => onCategory(rail.category)} />
      <ShopRail items={ranked(rail.shops)} onSelect={onSelect} width={railCard} />
    </View>)}

    <View style={s.section}>
      <RailHeading title="All shops" />
      {moreRows > 0 && <View style={s.rows}>{all.slice(0, moreRows).map(({ shop, miles }) => <ShopRow key={shop.id} shop={shop} miles={miles} onSelect={onSelect} />)}</View>}
      {hiddenRows > 0 && <Pressable accessibilityRole="button" onPress={() => setMoreRows(count => count + ROWS_PER_TAP)} style={({ pressed }) => [s.showMore, pressed && s.pressed]}><Text style={s.moreText}>{moreRows === 0 ? `Browse all ${all.length} shops` : `Show ${nextBatch} more ${nextBatch === 1 ? 'shop' : 'shops'}`}</Text><Arrow color={c.primary} /></Pressable>}
    </View>
  </>
}

export const homeStyles = StyleSheet.create({
  title: { fontFamily: fonts.nativeDisplay, fontSize: 42, lineHeight: 46, letterSpacing: -1, color: c.foreground, marginTop: 6, marginBottom: 20 },
  sectionHeading: { fontFamily: fonts.nativeDisplaySemibold, fontSize: 23, color: c.foreground, marginTop: 32, marginBottom: 14 },
})
const s = StyleSheet.create({
  pressed: { opacity: 0.78 },
  hero: { borderRadius: 22, overflow: 'hidden', backgroundColor: c.olive },
  photo: { height: 128, backgroundColor: c.sage, overflow: 'hidden' },
  largePhoto: { height: 200 },
  photoFallback: { flex: 1, padding: 20, justifyContent: 'center', alignItems: 'center' },
  initial: { fontFamily: fonts.nativeDisplay, fontSize: 56, color: c.olive },
  fallbackCategory: { fontSize: 13, color: c.sageInk, textAlign: 'center' },
  heroCopy: { padding: 18, gap: 8 },
  heroName: { fontFamily: fonts.nativeDisplay, fontSize: 27, color: c.oliveInk, letterSpacing: -0.6 },
  heroDescription: { fontSize: 15, lineHeight: 21, color: c.oliveInk },
  offer: { marginTop: 6, paddingHorizontal: 16, paddingVertical: 13, borderRadius: 24, backgroundColor: c.sage, flexDirection: 'row', alignItems: 'center', gap: 12 },
  offerText: { flex: 1, fontSize: 14, fontWeight: '600', color: c.sageInk },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 12 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: c.border },
  dotActive: { width: 20, backgroundColor: c.primary },
  section: { marginTop: 28 },
  heading: { fontFamily: fonts.nativeDisplaySemibold, fontSize: 22, color: c.foreground, letterSpacing: -0.4, marginBottom: 14 },
  headingRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 12, rowGap: 8, marginBottom: 12 },
  headingInRow: { marginBottom: 0, flexShrink: 1 },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  loyaltyCard: { padding: 18, borderRadius: 20, gap: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardName: { fontFamily: fonts.nativeDisplay, fontSize: 21, letterSpacing: -0.4 },
  cardReward: { fontSize: 14, lineHeight: 20 },
  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden', marginVertical: 4 },
  progressFill: { height: 8, borderRadius: 4 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  cardCount: { fontSize: 14, fontWeight: '600' },
  readyPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: c.primary },
  readyText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  moreText: { color: c.primary, fontSize: 15, fontWeight: '600' },
  locationButton: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 14, borderRadius: 22, backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
  locationButtonText: { color: c.foreground, fontSize: 14, fontWeight: '600' },
  locationText: { color: c.muted, fontSize: 14 },
  locationReady: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  locationReadyText: { color: c.muted, fontSize: 14, fontWeight: '600' },
  rail: { marginHorizontal: -20 },
  railContent: { paddingHorizontal: 20, gap: RAIL_GAP, paddingBottom: 4 },
  tile: { backgroundColor: c.card, borderRadius: 18, overflow: 'hidden' },
  tileCopy: { padding: 12, gap: 3 },
  tileName: { fontFamily: fonts.nativeDisplaySemibold, fontSize: 17, color: c.foreground },
  tileCategory: { fontSize: 13, color: c.muted },
  distancePill: { position: 'absolute', left: 10, top: 10, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 14, backgroundColor: 'rgba(252,252,250,0.95)' },
  distanceText: { color: c.foreground, fontSize: 12, fontWeight: '600' },
  circleItem: { width: 72, alignItems: 'center', gap: 6 },
  circle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  circleActive: { borderColor: c.primary },
  circleLetter: { fontFamily: fonts.nativeDisplay, fontSize: 24, color: c.foreground },
  circleLabel: { fontSize: 12, fontWeight: '600', color: c.foreground, textAlign: 'center' },
  rows: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 16, backgroundColor: c.card },
  mark: { width: 44, height: 44, borderRadius: 12, backgroundColor: c.olive, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  markInitial: { fontFamily: fonts.nativeDisplay, fontSize: 19, color: c.oliveInk },
  rowCopy: { flex: 1, gap: 2 },
  rowName: { fontFamily: fonts.nativeDisplaySemibold, fontSize: 16, color: c.foreground },
  rowMeta: { fontSize: 13, color: c.muted },
  showMore: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 10, minHeight: 48, marginTop: 4, paddingHorizontal: 18, borderRadius: 24, backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
  empty: { paddingVertical: 24 },
  emptyText: { color: c.muted, fontSize: 16, lineHeight: 24 },
})
