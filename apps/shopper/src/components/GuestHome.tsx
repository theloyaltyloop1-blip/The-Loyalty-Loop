import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import * as SecureStore from 'expo-secure-store'
import { supabase } from '../supabase'
import { Sheet } from './Sheet'
import { INK, MUTED, NIGHT, PAPER, SANS_HEAVY, SANS_MEDIUM, STONE } from './Poster'
import { shopMoney } from '../money'

// The app before an account: people see real shops straight away, answer one
// question, and are only asked to sign up when there is a card to save.

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

const INTERESTS_KEY = 'guest_interests'
const DEFAULT_INTERESTS = ['Café', 'Bakery', 'Restaurant', 'Deli', 'Barber', 'Beauty', 'Florist', 'Gym']

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

export function GuestHome({ onJoin, onSignUp, onSignIn }: {
  onJoin: (shop: GuestShop) => void
  onSignUp: () => void
  onSignIn: () => void
}) {
  const [interests, setInterests] = useState<string[] | null>(null)
  const [asking, setAsking] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const [shops, setShops] = useState<GuestShop[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<GuestShop | null>(null)

  useEffect(() => {
    SecureStore.getItemAsync(INTERESTS_KEY).then((raw) => {
      const saved = raw ? (JSON.parse(raw) as string[]) : null
      setInterests(saved)
      setAsking(saved === null)
    }).catch(() => { setInterests([]); setAsking(true) })
  }, [])

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

  const categories = useMemo(() => {
    const live = shops.map(s => s.category || 'Other')
    return Array.from(new Set([...DEFAULT_INTERESTS, ...live]))
  }, [shops])

  function toggle(cat: string) {
    void Haptics.selectionAsync().catch(() => undefined)
    setPicked(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])
  }

  async function saveInterests() {
    setInterests(picked)
    setAsking(false)
    await SecureStore.setItemAsync(INTERESTS_KEY, JSON.stringify(picked)).catch(() => undefined)
  }

  if (interests === null && !asking) {
    return <SafeAreaView style={s.safe}><View style={s.center}><ActivityIndicator color={NIGHT} /></View></SafeAreaView>
  }

  // The one setup question.
  if (asking) {
    return (
      <SafeAreaView style={s.safe}>
        <ScrollView contentContainerStyle={s.askWrap}>
          <Text style={s.eyebrow}>THE LOYALTY LOOP</Text>
          <Text accessibilityRole="header" style={s.askTitle}>What are{'\n'}you into?</Text>
          <Text style={s.askCopy}>Pick a few. You can change it later.</Text>
          <View style={s.chips}>
            {categories.map(cat => {
              const on = picked.includes(cat)
              return (
                <Pressable key={cat} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => toggle(cat)} style={({ pressed }) => [s.chip, on && s.chipOn, pressed && s.pressed]}>
                  <Text style={[s.chipText, on && s.chipTextOn]}>{cat}</Text>
                </Pressable>
              )
            })}
          </View>
        </ScrollView>
        <View style={s.footer}>
          <Pressable accessibilityRole="button" onPress={() => void saveInterests()} style={({ pressed }) => [s.primary, pressed && s.pressed]}>
            <Text style={s.primaryText}>{picked.length ? 'Show shops' : 'Show all shops'}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  const chosen = interests ?? []
  const matches = chosen.length ? shops.filter(sh => chosen.includes(sh.category || 'Other')) : shops
  const others = chosen.length ? shops.filter(sh => !chosen.includes(sh.category || 'Other')) : []

  const row = (shop: GuestShop) => (
    <Pressable key={shop.id} accessibilityRole="button" accessibilityLabel={`${shop.name}. ${rewardLine(shop)}`} onPress={() => setOpen(shop)} style={({ pressed }) => [s.row, pressed && s.pressed]}>
      {shop.logo_url
        ? <Image source={{ uri: shop.logo_url }} style={s.logo} />
        : <View style={[s.logo, { backgroundColor: shop.brand_color || NIGHT }]}><Text style={s.logoText}>{initials(shop.name)}</Text></View>}
      <View style={{ flex: 1 }}>
        <Text style={s.rowName} numberOfLines={1}>{shop.name}</Text>
        <Text style={s.rowMeta} numberOfLines={1}>{[shop.category || 'Local business', shop.postcode].filter(Boolean).join(' · ')}</Text>
        <Text style={s.rowReward} numberOfLines={2}>{rewardLine(shop)}</Text>
      </View>
    </Pressable>
  )

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.topBar}>
        <Text style={s.eyebrow}>THE LOYALTY LOOP</Text>
        <Pressable accessibilityRole="button" onPress={onSignIn} hitSlop={10}><Text style={s.signIn}>Sign in</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={s.list} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={NIGHT} />}>
        <Text accessibilityRole="header" style={s.title}>Local{'\n'}shops</Text>
        <Pressable accessibilityRole="button" onPress={() => { setPicked(chosen); setAsking(true) }} hitSlop={8}>
          <Text style={s.change}>{chosen.length ? `${chosen.join(', ')} · Change` : 'All shops · Choose what you like'}</Text>
        </Pressable>
        {loading && !shops.length ? <ActivityIndicator color={NIGHT} style={{ marginTop: 40 }} /> : null}
        {!loading && !matches.length && chosen.length ? <Text style={s.empty}>No {chosen.join(' or ')} shops here yet. Here’s everything else nearby.</Text> : null}
        {matches.map(row)}
        {others.length ? <Text style={s.section}>MORE SHOPS</Text> : null}
        {others.map(row)}
      </ScrollView>
      <View style={s.saveBar}>
        <Text style={s.saveText}>Save cards and collect rewards</Text>
        <Pressable accessibilityRole="button" onPress={onSignUp} style={({ pressed }) => [s.saveButton, pressed && s.pressed]}>
          <Text style={s.saveButtonText}>Sign up</Text>
        </Pressable>
      </View>
      <Sheet visible={open !== null} onClose={() => setOpen(null)} sheetStyle={s.sheet}>
        <SafeAreaView edges={['bottom']}>
          <View style={s.handle} />
          {open && <>
            <Text style={s.rowMeta}>{(open.category || 'Local business').toUpperCase()}</Text>
            <Text accessibilityRole="header" style={s.sheetTitle}>{open.name}</Text>
            {open.address ? <Text style={s.sheetAddress}>{[open.address, open.postcode].filter(Boolean).join(', ')}</Text> : null}
            <View style={s.rewardBox}><Text style={s.rewardLabel}>THE REWARD</Text><Text style={s.rewardText}>{rewardLine(open)}</Text></View>
            <Pressable accessibilityRole="button" onPress={() => { const shop = open; setOpen(null); onJoin(shop) }} style={({ pressed }) => [s.primary, pressed && s.pressed]}>
              <Text style={s.primaryText}>Join card</Text>
            </Pressable>
            <Text style={s.sheetSmall}>You’ll make a free account so your card is saved.</Text>
          </>}
        </SafeAreaView>
      </Sheet>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: PAPER },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.75 },
  eyebrow: { color: MUTED, fontSize: 11, letterSpacing: 1.6, fontFamily: SANS_MEDIUM },
  askWrap: { padding: 24, paddingTop: 48 },
  askTitle: { color: INK, fontSize: 56, lineHeight: 58, fontFamily: SANS_HEAVY, letterSpacing: -1.5, marginTop: 18 },
  askCopy: { color: MUTED, fontSize: 16, marginTop: 12, marginBottom: 28, fontFamily: SANS_MEDIUM },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: 999, backgroundColor: STONE },
  chipOn: { backgroundColor: NIGHT },
  chipText: { color: INK, fontSize: 15, fontFamily: SANS_MEDIUM },
  chipTextOn: { color: PAPER },
  footer: { padding: 20 },
  primary: { backgroundColor: NIGHT, borderRadius: 999, paddingVertical: 17, alignItems: 'center', shadowColor: INK, shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  primaryText: { color: PAPER, fontSize: 17, fontFamily: SANS_HEAVY },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  signIn: { color: NIGHT, fontSize: 15, fontFamily: SANS_HEAVY },
  list: { paddingHorizontal: 20, paddingBottom: 24 },
  title: { color: INK, fontSize: 56, lineHeight: 58, fontFamily: SANS_HEAVY, letterSpacing: -1.5, marginTop: 12 },
  change: { color: NIGHT, fontSize: 14, fontFamily: SANS_MEDIUM, marginTop: 10, marginBottom: 18 },
  empty: { color: MUTED, fontSize: 15, marginBottom: 14 },
  section: { color: MUTED, fontSize: 11, letterSpacing: 1.6, fontFamily: SANS_MEDIUM, marginTop: 18, marginBottom: 10 },
  row: { flexDirection: 'row', gap: 14, alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 22, padding: 14, marginBottom: 10, shadowColor: INK, shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  logo: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: STONE },
  logoText: { color: '#FFFFFF', fontSize: 17, fontFamily: SANS_HEAVY },
  rowName: { color: INK, fontSize: 17, fontFamily: SANS_HEAVY },
  rowMeta: { color: MUTED, fontSize: 11, letterSpacing: 1, fontFamily: SANS_MEDIUM, marginTop: 2 },
  rowReward: { color: INK, fontSize: 14, marginTop: 6, fontFamily: SANS_MEDIUM },
  saveBar: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginBottom: 8, backgroundColor: '#FFFFFF', borderRadius: 22, padding: 12, paddingLeft: 18, shadowColor: INK, shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  saveText: { flex: 1, color: INK, fontSize: 14, fontFamily: SANS_MEDIUM },
  saveButton: { backgroundColor: NIGHT, borderRadius: 999, paddingVertical: 11, paddingHorizontal: 20 },
  saveButtonText: { color: PAPER, fontSize: 15, fontFamily: SANS_HEAVY },
  sheet: { backgroundColor: PAPER, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 22, paddingTop: 12, paddingBottom: 16 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.15)', alignSelf: 'center', marginBottom: 18 },
  sheetTitle: { color: INK, fontSize: 36, lineHeight: 40, fontFamily: SANS_HEAVY, letterSpacing: -0.8, marginTop: 6 },
  sheetAddress: { color: MUTED, fontSize: 15, marginTop: 6 },
  rewardBox: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, marginTop: 20, marginBottom: 20 },
  rewardLabel: { color: MUTED, fontSize: 11, letterSpacing: 1.6, fontFamily: SANS_MEDIUM },
  rewardText: { color: INK, fontSize: 20, lineHeight: 26, fontFamily: SANS_HEAVY, marginTop: 6 },
  sheetSmall: { color: MUTED, fontSize: 13, textAlign: 'center', marginTop: 12 },
})
