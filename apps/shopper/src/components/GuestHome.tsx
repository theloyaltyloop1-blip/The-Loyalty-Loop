import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { supabase } from '../supabase'
import { Sheet } from './Sheet'
import { FadeUp, INK, MUTED, NIGHT, PACIFIC, PAPER, SAGE, SANS_HEAVY, SANS_MEDIUM, SLATE, STONE } from './Poster'
import { shopMoney } from '../money'

// The app before an account: real shops straight away, shown as the cards
// people will carry. An account is only asked for when there is a card to save.

export type GuestShop = {
  id: string
  name: string
  category?: string | null
  address?: string | null
  postcode?: string | null
  logo_url?: string | null
  brand_color?: string | null
  country_code?: string | null
  reward_model?: string | null
  loyalty_type?: string | null
  loyalty_config?: { stamps_required?: number } | null
  reward_threshold_pence?: number | null
  programme_rules?: { summary?: string } | null
}

export function rewardLine(shop: GuestShop): string {
  const summary = shop.programme_rules?.summary?.trim()
  if (shop.reward_model === 'custom' && summary) return summary
  if (shop.loyalty_type === 'stamps') {
    const n = shop.loyalty_config?.stamps_required
    return n ? `Collect ${n} stamps for a reward.` : 'Collect stamps for rewards.'
  }
  if (shop.reward_threshold_pence) return `Spend ${shopMoney(shop.country_code)(shop.reward_threshold_pence).replace(/\.00$/, '')}, get a reward.`
  return 'Earn rewards every time you visit.'
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('')
}

const FALLBACKS = [NIGHT, SLATE, PACIFIC, SAGE]

/** The shop's own colour, or a palette colour picked from its name. */
function cardColour(shop: GuestShop) {
  const c = shop.brand_color?.trim()
  if (c && /^#[0-9a-f]{6}$/i.test(c)) return c
  let h = 0
  for (const ch of shop.name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return FALLBACKS[h % FALLBACKS.length]
}

/** Dark text on light cards, light text on dark ones. */
function inkOn(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? INK : '#FFFFFF'
}

function ShopCard({ shop, onPress, big = false }: { shop: GuestShop; onPress?: () => void; big?: boolean }) {
  const bg = cardColour(shop)
  const fg = inkOn(bg)
  const body = (
    <View style={[c.card, big && c.cardBig, { backgroundColor: bg }]}>
      <View style={[c.ring, { borderColor: fg }]} />
      <View style={c.top}>
        {shop.logo_url
          ? <Image source={{ uri: shop.logo_url }} style={c.logo} />
          : <View style={[c.logo, c.logoBlank]}><Text style={[c.logoText, { color: bg }]}>{initials(shop.name)}</Text></View>}
        <Text style={[c.category, { color: fg }]} numberOfLines={1}>{(shop.category || 'Local').toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1 }} />
      <Text style={[c.name, big && c.nameBig, { color: fg }]} numberOfLines={2}>{shop.name}</Text>
      <View style={c.rewardPill}>
        <Text style={c.rewardText} numberOfLines={big ? 3 : 1}>{rewardLine(shop)}</Text>
      </View>
    </View>
  )
  if (!onPress) return body
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${shop.name}. ${rewardLine(shop)}`} onPress={onPress} style={({ pressed }) => [pressed && { transform: [{ scale: 0.98 }] }]}>
      {body}
    </Pressable>
  )
}

export function GuestHome({ onJoin, onSignUp, onSignIn }: {
  onJoin: (shop: GuestShop) => void
  onSignUp: () => void
  onSignIn: () => void
}) {
  const [shops, setShops] = useState<GuestShop[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string | null>(null)
  const [open, setOpen] = useState<GuestShop | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('businesses')
      .select('id,name,category,address,postcode,logo_url,brand_color,country_code,reward_model,loyalty_type,loyalty_config,reward_threshold_pence,programme_rules')
      .eq('is_active', true)
      .order('name')
    setShops((data ?? []) as GuestShop[])
    setLoading(false)
  }
  useEffect(() => { void load() }, [])

  const categories = useMemo(() => Array.from(new Set(shops.map(s => s.category).filter((x): x is string => Boolean(x)))).sort(), [shops])
  const shown = filter ? shops.filter(s => s.category === filter) : shops

  function pick(cat: string | null) {
    void Haptics.selectionAsync().catch(() => undefined)
    setFilter(cat)
  }

  function openShop(shop: GuestShop) {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)
    setOpen(shop)
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading && shops.length > 0} onRefresh={load} tintColor={NIGHT} />}
      >
        <View style={s.topBar}>
          <Text style={s.brand}>The Loyalty Loop</Text>
          <Pressable accessibilityRole="button" onPress={onSignIn} hitSlop={10} style={({ pressed }) => [s.signIn, pressed && s.pressed]}>
            <Text style={s.signInText}>Sign in</Text>
          </Pressable>
        </View>

        <FadeUp>
          <Text accessibilityRole="header" style={s.title}>Rewards from{'\n'}shops near you</Text>
          <Text style={s.copy}>Tap a card to see the reward. Joining is free.</Text>
        </FadeUp>

        {categories.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters} style={s.filterStrip}>
            {[null, ...categories].map(cat => {
              const on = filter === cat
              return (
                <Pressable key={cat ?? 'all'} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => pick(cat)} style={({ pressed }) => [s.filter, on && s.filterOn, pressed && s.pressed]}>
                  <Text style={[s.filterText, on && s.filterTextOn]}>{cat ?? 'All'}</Text>
                </Pressable>
              )
            })}
          </ScrollView>
        ) : <View style={{ height: 22 }} />}

        {loading && !shops.length ? <ActivityIndicator color={NIGHT} style={{ marginTop: 48 }} /> : null}
        {!loading && !shops.length ? <Text style={s.empty}>No shops yet. Pull down to check again.</Text> : null}

        {shown.map((shop, i) => (
          <FadeUp key={shop.id} delay={Math.min(i, 6) * 70} style={s.cardGap}>
            <ShopCard shop={shop} onPress={() => openShop(shop)} />
          </FadeUp>
        ))}
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={s.saveWrap} pointerEvents="box-none">
        <View style={s.saveBar}>
          <View style={{ flex: 1 }}>
            <Text style={s.saveTitle}>Keep your cards</Text>
            <Text style={s.saveCopy}>Free, and takes a few seconds</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={onSignUp} style={({ pressed }) => [s.saveButton, pressed && s.pressed]}>
            <Text style={s.saveButtonText}>Sign up</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      <Sheet visible={open !== null} onClose={() => setOpen(null)} sheetStyle={s.sheet}>
        <SafeAreaView edges={['bottom']}>
          <View style={s.handle} />
          {open && <>
            <ShopCard shop={open} big />
            {open.address ? <Text style={s.address}>{[open.address, open.postcode].filter(Boolean).join(', ')}</Text> : null}
            <Pressable accessibilityRole="button" onPress={() => { const shop = open; setOpen(null); onJoin(shop) }} style={({ pressed }) => [s.primary, pressed && s.pressed]}>
              <Text style={s.primaryText} numberOfLines={1}>Join {open.name}</Text>
            </Pressable>
            <Text style={s.sheetSmall}>Free. We’ll save the card to a new account for you.</Text>
          </>}
        </SafeAreaView>
      </Sheet>
    </SafeAreaView>
  )
}

const c = StyleSheet.create({
  card: { height: 188, borderRadius: 26, padding: 18, overflow: 'hidden', shadowColor: INK, shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 5 },
  cardBig: { height: 230 },
  ring: { position: 'absolute', right: -60, top: -70, width: 210, height: 210, borderRadius: 105, borderWidth: 26, opacity: 0.08 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF' },
  logoBlank: { alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 14, fontFamily: SANS_HEAVY },
  category: { flex: 1, fontSize: 11, letterSpacing: 1.6, fontFamily: SANS_MEDIUM, opacity: 0.8 },
  name: { fontSize: 26, lineHeight: 30, fontFamily: SANS_HEAVY, letterSpacing: -0.6 },
  nameBig: { fontSize: 32, lineHeight: 36 },
  rewardPill: { alignSelf: 'flex-start', maxWidth: '100%', backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12, marginTop: 12 },
  rewardText: { color: INK, fontSize: 14, lineHeight: 19, fontFamily: SANS_MEDIUM },
})

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: PAPER },
  pressed: { opacity: 0.75 },
  scroll: { paddingHorizontal: 20, paddingBottom: 130 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 },
  brand: { color: INK, fontSize: 15, fontFamily: SANS_HEAVY, letterSpacing: -0.2 },
  signIn: { backgroundColor: STONE, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16 },
  signInText: { color: INK, fontSize: 14, fontFamily: SANS_HEAVY },
  title: { color: INK, fontSize: 40, lineHeight: 44, fontFamily: SANS_HEAVY, letterSpacing: -1.2, marginTop: 28 },
  copy: { color: MUTED, fontSize: 16, lineHeight: 22, fontFamily: SANS_MEDIUM, marginTop: 10 },
  filterStrip: { marginHorizontal: -20, marginTop: 22, marginBottom: 18 },
  filters: { paddingHorizontal: 20, gap: 8 },
  filter: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: STONE },
  filterOn: { backgroundColor: NIGHT, borderColor: NIGHT },
  filterText: { color: INK, fontSize: 14, fontFamily: SANS_MEDIUM },
  filterTextOn: { color: PAPER },
  empty: { color: MUTED, fontSize: 15, marginTop: 30, textAlign: 'center' },
  cardGap: { marginBottom: 14 },
  saveWrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  saveBar: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginBottom: 10, backgroundColor: INK, borderRadius: 24, padding: 10, paddingLeft: 20, shadowColor: INK, shadowOpacity: 0.3, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
  saveTitle: { color: '#FFFFFF', fontSize: 15, fontFamily: SANS_HEAVY },
  saveCopy: { color: 'rgba(255,255,255,0.65)', fontSize: 12, fontFamily: SANS_MEDIUM, marginTop: 2 },
  saveButton: { backgroundColor: '#FFFFFF', borderRadius: 999, paddingVertical: 12, paddingHorizontal: 20 },
  saveButtonText: { color: INK, fontSize: 15, fontFamily: SANS_HEAVY },
  sheet: { backgroundColor: PAPER, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.15)', alignSelf: 'center', marginBottom: 16 },
  address: { color: MUTED, fontSize: 14, fontFamily: SANS_MEDIUM, marginTop: 14, textAlign: 'center' },
  primary: { backgroundColor: NIGHT, borderRadius: 999, paddingVertical: 17, paddingHorizontal: 20, alignItems: 'center', marginTop: 18, shadowColor: INK, shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  primaryText: { color: PAPER, fontSize: 17, fontFamily: SANS_HEAVY },
  sheetSmall: { color: MUTED, fontSize: 13, textAlign: 'center', marginTop: 12 },
})
