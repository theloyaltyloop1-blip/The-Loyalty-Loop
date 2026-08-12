import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { WebView } from 'react-native-webview'
import Svg, { Circle, Path } from 'react-native-svg'
import QRCode from 'react-native-qrcode-svg'
import type { Session } from '@supabase/supabase-js'
import { colors } from '@loyalty-loop/design-tokens'
import { hasSupabaseConfig, supabase } from './src/supabase'
import logo from './assets/brand/loyalty-loop-logo.png'

const { background, foreground, card, primary, primaryHover, accent, funGreen, ink } = colors

// ---------------------------------------------------------------------
// Icons — small, consistent line icons (stroke-based, 2px, round caps)
// matching the web app's lucide-react icon language without adding a
// native icon-library dependency.
// ---------------------------------------------------------------------

type IconProps = { color?: string; size?: number; filled?: boolean }

function HomeIcon({ color = foreground, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 11.5 12 4l9 7.5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M5.5 10v9a1 1 0 0 0 1 1H10v-6h4v6h3.5a1 1 0 0 0 1-1v-9" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

function MapPinIcon({ color = foreground, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 21s-7-6.2-7-11.2A7 7 0 0 1 19 9.8C19 14.8 12 21 12 21z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={9.8} r={2.4} stroke={color} strokeWidth={2} />
    </Svg>
  )
}

function MegaphoneIcon({ color = foreground, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 10.5v3a2 2 0 0 0 2 2h1.4l3.1 5V3.5l-3.1 5H5a2 2 0 0 0-2 2z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M14.5 8a4 4 0 0 1 0 8" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  )
}

function GiftIcon({ color = foreground, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 9.5h16V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M2.5 6h19v3.5h-19z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M12 6v14" stroke={color} strokeWidth={2} />
      <Path
        d="M12 6C9.8 6 8 4.8 8 3.3S9.6 1.2 12 4c2.4-2.8 4-1.7 4-.2S14.2 6 12 6z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  )
}

function HeartIcon({ color = foreground, size = 22, filled = false }: IconProps) {
  const d = 'M12 21s-7.8-4.7-10.2-9.4C.3 8.2 2.4 4.5 6.2 4.5c2.2 0 4 1.3 5.8 3.6 1.8-2.3 3.6-3.6 5.8-3.6 3.8 0 5.9 3.7 4.4 7.1C19.8 16.3 12 21 12 21z'
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={d} stroke={color} strokeWidth={2} strokeLinejoin="round" fill={filled ? color : 'none'} />
    </Svg>
  )
}

function UserIcon({ color = foreground, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={3.6} stroke={color} strokeWidth={2} />
      <Path d="M4.5 20c0-4 3.5-6.5 7.5-6.5s7.5 2.5 7.5 6.5" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  )
}

function ChevronLeftIcon({ color = foreground, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M15 5.5 8.5 12l6.5 6.5" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

function ArrowRightIcon({ color = primary, size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 12h16M13 5.5 19.5 12 13 18.5" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

function CloseIcon({ color = foreground, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 6l12 12M18 6 6 18" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  )
}

function WalletIcon({ color = '#fff', size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v2" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M3 7v11a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M16 14h2" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  )
}

// ---------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------

type Business = {
  id: string
  name: string
  category?: string | null
  description?: string | null
  address?: string | null
  lat?: number | null
  lng?: number | null
  brand_color?: string
  logo_url?: string | null
  cover_url?: string | null
  loyalty_type?: string
  loyalty_config?: { stamps_required?: number }
}
type Membership = { business_id: string; stamp_count: number; points_balance: number }
type Reward = {
  id: string
  title: string
  short_code: string
  qr_token: string
  expires_at?: string | null
  redeemed_at?: string | null
  business?: { name: string; brand_color?: string; logo_url?: string | null } | null
}
type RewardCatalogItem = {
  id: string
  title: string
  description?: string | null
  stamp_threshold: number
}
type Announcement = {
  id: string
  title: string
  body: string | null
  created_at: string
  business: { name: string; brand_color?: string; logo_url?: string | null } | null
}
type Tab = 'home' | 'map' | 'news' | 'rewards' | 'favourites'

const isShopper = (roles: string[]) =>
  roles.includes('consumer') && !roles.some((role) => ['business_owner', 'staff', 'brand_head'].includes(role))

// ---------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------

function Button({ title, onPress, secondary, disabled }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={[styles.button, secondary && styles.buttonSecondary, disabled && styles.disabled]}>
      <Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>{title}</Text>
    </Pressable>
  )
}

function AppHeader({ onOpenProfile }: { onOpenProfile: () => void }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerBrand}>
        <Image source={logo} style={styles.headerLogo} />
        <Text style={styles.headerTitle}>The Loyalty Loop</Text>
      </View>
      <Pressable onPress={onOpenProfile} hitSlop={10} style={styles.headerProfileButton}>
        <UserIcon />
      </Pressable>
    </View>
  )
}

// ---------------------------------------------------------------------
// Onboarding / auth
// ---------------------------------------------------------------------

function ShopperLanding({ onContinue }: { onContinue: () => void }) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.auth}>
        <View style={styles.mark}>
          <Image source={logo} style={styles.markImage} />
        </View>
        <Text style={styles.eyebrow}>THE LOYALTY LOOP</Text>
        <Text style={styles.hero}>More of the places{'\n'}you already love.</Text>
        <Text style={styles.copy}>Discover local favourites, collect every visit and keep your rewards in one place.</Text>
        <View style={styles.card}>
          <Text style={styles.landingTitle}>01  Join a loyalty card</Text>
          <Text style={styles.landingCopy}>Find a local business and join in seconds.</Text>
          <Text style={styles.landingTitle}>02  Collect as you visit</Text>
          <Text style={styles.landingCopy}>Show your QR code to earn stamps, visits or points.</Text>
          <Text style={styles.landingTitle}>03  Enjoy your reward</Text>
          <Text style={styles.landingCopy}>Unlocked rewards are ready in the app.</Text>
        </View>
        <Button title="Start collecting" onPress={onContinue} />
        <Text style={styles.small}>Already collecting? Sign in or create an account on the next screen.</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

function AuthScreen({ onSession }: { onSession: (session: Session) => void }) {
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!email.trim() || password.length < 6 || (mode === 'signUp' && !name.trim())) {
      return Alert.alert('Check your details', 'Enter your name, email and a password of at least 6 characters.')
    }
    setBusy(true)
    try {
      if (mode === 'signUp') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { first_name: name.trim(), intent: 'consumer', legal_accepted: true } },
        })
        if (error) throw error
        if (data.session) onSession(data.session)
        else Alert.alert('Check your email', 'Confirm your email address, then sign in to start collecting rewards.')
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
        onSession(data.session)
      }
    } catch (e) {
      Alert.alert('Could not continue', e instanceof Error ? e.message : 'Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.auth} keyboardShouldPersistTaps="handled">
        <View style={styles.mark}>
          <Image source={logo} style={styles.markImage} />
        </View>
        <Text style={styles.eyebrow}>THE LOYALTY LOOP</Text>
        <Text style={styles.hero}>Local rewards,{'\n'}in your pocket.</Text>
        <Text style={styles.copy}>Collect loyalty rewards from the places you love.</Text>
        <View style={styles.card}>
          {mode === 'signUp' && (
            <TextInput value={name} onChangeText={setName} placeholder="First name" placeholderTextColor="#8a8378" style={styles.input} autoCapitalize="words" />
          )}
          <TextInput value={email} onChangeText={setEmail} placeholder="Email address" placeholderTextColor="#8a8378" style={styles.input} keyboardType="email-address" autoCapitalize="none" />
          <TextInput value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor="#8a8378" style={styles.input} secureTextEntry />
          <Button title={busy ? 'Please wait…' : mode === 'signIn' ? 'Sign in' : 'Create shopper account'} onPress={submit} disabled={busy} />
          <Pressable onPress={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}>
            <Text style={styles.link}>{mode === 'signIn' ? 'New here? Create an account' : 'Already have an account? Sign in'}</Text>
          </Pressable>
        </View>
        <Text style={styles.small}>Business or staff account? Use The Loyalty Loop for Business app.</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

// ---------------------------------------------------------------------
// Profile sheet (opened from the header icon)
// ---------------------------------------------------------------------

function ProfileSheet({ session, userId, onClose }: { session: Session; userId: string; onClose: () => void }) {
  return (
    <Modal animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose} />
      <SafeAreaView style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeaderRow}>
          <Text style={styles.sheetTitle}>Your account</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <CloseIcon />
          </Pressable>
        </View>
        <Text style={styles.title}>{session.user.user_metadata?.first_name || 'Shopper'}</Text>
        <Text style={styles.description}>{session.user.email}</Text>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Your customer card</Text>
          <View style={styles.qrWrap}>
            <QRCode value={`loyaltyloop:customer:${userId}`} size={160} />
          </View>
          <Text style={[styles.small, { marginTop: 14 }]}>Show this at a participating shop to collect rewards.</Text>
        </View>
        <Button title="Sign out" secondary onPress={() => supabase.auth.signOut()} />
      </SafeAreaView>
    </Modal>
  )
}

// ---------------------------------------------------------------------
// Shop detail
// ---------------------------------------------------------------------

function ShopDetail({
  business,
  userId,
  membership,
  favourite,
  onBack,
  onToggleFavourite,
  refresh,
}: {
  business: Business
  userId: string
  membership?: Membership
  favourite: boolean
  onBack: () => void
  onToggleFavourite: () => void
  refresh: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [addingToWallet, setAddingToWallet] = useState(false)
  const [catalog, setCatalog] = useState<RewardCatalogItem[]>([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const threshold = business.loyalty_config?.stamps_required || 10
  const value = business.loyalty_type === 'points' ? membership?.points_balance || 0 : membership?.stamp_count || 0
  const label = business.loyalty_type === 'points' ? 'points' : business.loyalty_type === 'tiered' ? 'visits' : 'stamps'

  useEffect(() => {
    let active = true
    setCatalogLoading(true)
    supabase
      .from('reward_catalog')
      .select('id,title,description,stamp_threshold')
      .eq('business_id', business.id)
      .order('stamp_threshold')
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          setCatalog([])
        } else {
          setCatalog(data || [])
        }
        setCatalogLoading(false)
      })
    return () => {
      active = false
    }
  }, [business.id])

  async function join() {
    setBusy(true)
    try {
      const { error } = await supabase.from('memberships').upsert({ user_id: userId, business_id: business.id }, { onConflict: 'user_id,business_id' })
      if (error) throw error
      await refresh()
    } catch (e) {
      Alert.alert('Could not join', e instanceof Error ? e.message : 'Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function addToWallet() {
    setAddingToWallet(true)
    try {
      const { data, error } = await supabase.functions.invoke<{ saveUrl?: string; error?: string }>('create-wallet-pass', {
        body: { business_id: business.id },
      })
      if (error) throw error
      if (!data?.saveUrl) throw new Error(data?.error || 'Could not create the pass')
      await Linking.openURL(data.saveUrl)
    } catch (e) {
      Alert.alert('Could not add to Google Wallet', e instanceof Error ? e.message : 'Please try again.')
    } finally {
      setAddingToWallet(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.screen}>
        <Pressable onPress={onBack} style={styles.backRow}>
          <ChevronLeftIcon size={18} />
          <Text style={styles.back}>Back</Text>
        </Pressable>

        <View style={[styles.detailCover, { backgroundColor: business.brand_color || primary }]}>
          {business.cover_url && <Image source={{ uri: business.cover_url }} style={StyleSheet.absoluteFill} />}
          <Pressable onPress={onToggleFavourite} style={styles.favouriteButton}>
            <HeartIcon color={favourite ? primary : foreground} filled={favourite} size={18} />
          </Pressable>
        </View>

        <Text style={styles.title}>{business.name}</Text>
        <Text style={styles.muted}>
          {business.category || 'Local business'}
          {business.address ? ` · ${business.address}` : ''}
        </Text>

        {membership ? (
          <View style={styles.loyaltyCard}>
            <View style={styles.loyaltyCardHeaderRow}>
              <Text style={styles.sectionTitle}>{business.loyalty_type === 'points' ? 'Your points' : 'Your stamp card'}</Text>
              <Text style={styles.loyaltyCardCount}>{value} / {threshold}</Text>
            </View>
            <View style={styles.bar}>
              <View style={[styles.barFill, { width: `${Math.min(100, (value / threshold) * 100)}%`, backgroundColor: business.brand_color || primary }]} />
            </View>
            <View style={styles.qrWrap}>
              <QRCode value={`loyaltyloop:customer:${userId}`} size={150} />
              <Text style={styles.qrText}>Show this QR code when you pay</Text>
            </View>
            <Pressable onPress={addToWallet} disabled={addingToWallet} style={[styles.walletButton, addingToWallet && styles.disabled]}>
              <WalletIcon size={17} />
              <Text style={styles.walletButtonText}>{addingToWallet ? 'Preparing…' : 'Add to Google Wallet'}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.joinCard}>
            <Text style={styles.joinTitle}>Join {business.name}'s loyalty card</Text>
            <View style={styles.rewardPill}>
              <Text style={styles.rewardPillText}>REWARDS YOU CAN UNLOCK</Text>
            </View>
            {catalogLoading ? (
              <ActivityIndicator color={business.brand_color || primary} style={{ marginVertical: 12 }} />
            ) : catalog.length ? (
              <View style={styles.rewardTierList}>
                {catalog.slice(0, 3).map((reward) => (
                  <View key={reward.id} style={styles.rewardTier}>
                    <Text style={styles.rewardTierThreshold}>{reward.stamp_threshold} {label}</Text>
                    <Text style={styles.rewardTierTitle}>{reward.title}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.rewardTitleLarge}>Rewards are being set up</Text>
            )}
            {!catalogLoading && catalog.length > 3 && <Text style={styles.muted}>Plus more rewards as you collect.</Text>}
            {!catalogLoading && !catalog.length && <Text style={styles.muted}>Collect {threshold} {label} to unlock a reward.</Text>}
            <View style={{ marginTop: 18 }}>
              <Button title={busy ? 'Joining…' : 'Join card'} onPress={join} disabled={busy} />
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>How it works</Text>
        <Text style={styles.description}>
          Earn a {label.slice(0, -1)} every time you visit. When you reach the target, your reward will appear in the Rewards tab.
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}

// ---------------------------------------------------------------------
// Home tab
// ---------------------------------------------------------------------

function CategoryPills({
  businesses,
  selected,
  onSelect,
}: {
  businesses: Business[]
  selected: string | null
  onSelect: (category: string | null) => void
}) {
  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const b of businesses) {
      const key = b.category || 'Other'
      map.set(key, (map.get(key) || 0) + 1)
    }
    return [...map.entries()]
  }, [businesses])

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
      <Pressable onPress={() => onSelect(null)} style={[styles.pill, selected === null && styles.pillActive]}>
        <Text style={[styles.pillText, selected === null && styles.pillTextActive]}>All categories</Text>
      </Pressable>
      {counts.map(([category, count]) => (
        <Pressable key={category} onPress={() => onSelect(category)} style={[styles.pill, selected === category && styles.pillActive]}>
          <Text style={[styles.pillText, selected === category && styles.pillTextActive]}>{category} · {count}</Text>
        </Pressable>
      ))}
    </ScrollView>
  )
}

function AnnouncementCard({ announcement }: { announcement: Announcement }) {
  return (
    <View style={styles.announcementCard}>
      <View style={styles.announcementBadge}>
        <MegaphoneIcon color={primary} size={16} />
      </View>
      <Text style={styles.announcementFrom}>{announcement.business?.name || 'The Loyalty Loop team'}</Text>
      <Text style={styles.announcementTitle}>{announcement.title}</Text>
      {!!announcement.body && (
        <Text style={styles.announcementBody} numberOfLines={3}>
          {announcement.body}
        </Text>
      )}
    </View>
  )
}

function TrendingCard({ business, onPress }: { business: Business; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.trendingCard}>
      <View style={[styles.trendingCover, { backgroundColor: business.brand_color || primary }]}>
        {business.cover_url && <Image source={{ uri: business.cover_url }} style={StyleSheet.absoluteFill} />}
      </View>
      <View style={styles.trendingContent}>
        <Text style={styles.trendingName} numberOfLines={1}>{business.name}</Text>
        <Text style={styles.muted} numberOfLines={1}>{business.category || 'Local business'}</Text>
      </View>
    </Pressable>
  )
}

function NearbyRow({ business, onPress }: { business: Business; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.nearbyRow}>
      {business.logo_url ? (
        <Image source={{ uri: business.logo_url }} style={styles.nearbyLogo} />
      ) : (
        <View style={[styles.nearbyLogo, { backgroundColor: business.brand_color || ink }]}>
          <Text style={styles.logoLetter}>{business.name[0]}</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.shopName}>{business.name}</Text>
        <Text style={styles.muted}>{business.category || 'Local business'}{business.address ? ` · ${business.address}` : ''}</Text>
      </View>
      <ArrowRightIcon />
    </Pressable>
  )
}

function HomeTab({
  businesses,
  announcements,
  onSelect,
}: {
  businesses: Business[]
  announcements: Announcement[]
  onSelect: (business: Business) => void
}) {
  const [category, setCategory] = useState<string | null>(null)
  const filtered = category ? businesses.filter((b) => (b.category || 'Other') === category) : businesses
  const trending = filtered.slice(0, 4)

  return (
    <>
      <Text style={styles.pageTitle}>Discover local rewards</Text>
      <CategoryPills businesses={businesses} selected={category} onSelect={setCategory} />

      {announcements.length > 0 && (
        <>
          <View style={styles.sectionHeaderRow}>
            <MegaphoneIcon color={foreground} size={14} />
            <Text style={styles.sectionEyebrow}>LATEST ANNOUNCEMENTS</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.announcementRow}>
            {announcements.map((a) => (
              <AnnouncementCard key={a.id} announcement={a} />
            ))}
          </ScrollView>
        </>
      )}

      {trending.length > 0 && (
        <>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sparkle}>✦</Text>
            <Text style={styles.sectionEyebrow}>TRENDING NEARBY</Text>
          </View>
          <View style={styles.trendingGrid}>
            {trending.map((b) => (
              <TrendingCard key={b.id} business={b} onPress={() => onSelect(b)} />
            ))}
          </View>
        </>
      )}

      <Text style={[styles.sectionEyebrow, { marginTop: 24, marginBottom: 12 }]}>NEARBY</Text>
      {filtered.map((b) => (
        <NearbyRow key={b.id} business={b} onPress={() => onSelect(b)} />
      ))}
      {filtered.length === 0 && <Text style={styles.empty}>No businesses match yet. Pull down to refresh.</Text>}
    </>
  )
}

// ---------------------------------------------------------------------
// Map tab — real Google Maps pins via a WebView running the Maps JS API.
// Avoids react-native-maps (whose native module needs a custom dev-client
// build, breaking plain Expo Go) while still giving a real interactive,
// pannable/zoomable Google map with tappable pins — same API key as web.
// ---------------------------------------------------------------------

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''

function buildMapHtml(pins: { id: string; lat: number; lng: number; name: string; color: string }[]) {
  const center = pins.length ? [pins[0].lat, pins[0].lng] : [51.4514, -0.1447] // Balham, as a sane default
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const pins = ${JSON.stringify(pins)};
    function initMap() {
      const map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: ${center[0]}, lng: ${center[1]} },
        zoom: ${pins.length ? 13 : 12},
        disableDefaultUI: true,
        gestureHandling: 'greedy',
      });
      pins.forEach(function (p) {
        const icon = {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
            '<svg width="30" height="40" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20c0-6.6-5.4-12-12-12z" fill="' + p.color + '" stroke="white" stroke-width="1.5"/><circle cx="12" cy="12" r="4.5" fill="white"/></svg>'
          ),
          scaledSize: new google.maps.Size(30, 40),
          anchor: new google.maps.Point(15, 40),
        };
        const marker = new google.maps.Marker({ position: { lat: p.lat, lng: p.lng }, map: map, icon: icon, title: p.name });
        const info = new google.maps.InfoWindow({
          content: '<div style="font-family:-apple-system,Roboto,sans-serif;font-weight:700;">' + p.name +
            '<div><a href="#" id="view-' + p.id + '" style="color:${primary};text-decoration:none;">View shop</a></div></div>',
        });
        marker.addListener('click', function () {
          info.open(map, marker);
          setTimeout(function () {
            const link = document.getElementById('view-' + p.id);
            if (link) link.onclick = function () { window.ReactNativeWebView.postMessage(p.id); };
          }, 0);
        });
      });
    }
  </script>
  <script src="https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=initMap" async defer></script>
</body>
</html>`
}

function MapTab({ businesses, onSelect }: { businesses: Business[]; onSelect: (business: Business) => void }) {
  const pins = businesses
    .filter((b): b is Business & { lat: number; lng: number } => b.lat != null && b.lng != null)
    .map((b) => ({ id: b.id, lat: b.lat, lng: b.lng, name: b.name, color: b.brand_color || primary }))
  const html = useMemo(() => buildMapHtml(pins), [JSON.stringify(pins)])

  return (
    <>
      <Text style={styles.pageTitle}>Shops near you</Text>
      {pins.length > 0 ? (
        <View style={styles.mapWebviewWrap}>
          <WebView
            source={{ html }}
            style={{ flex: 1 }}
            onMessage={(e) => {
              const business = businesses.find((b) => b.id === e.nativeEvent.data)
              if (business) onSelect(business)
            }}
          />
        </View>
      ) : (
        <View style={styles.mapPlaceholder}>
          <MapPinIcon color={primary} size={30} />
          <Text style={styles.mapPlaceholderText}>No shops have a pinned location yet.</Text>
        </View>
      )}
      {businesses.map((b) => (
        <NearbyRow key={b.id} business={b} onPress={() => onSelect(b)} />
      ))}
    </>
  )
}

// ---------------------------------------------------------------------
// News tab
// ---------------------------------------------------------------------

function NewsTab({ announcements }: { announcements: Announcement[] }) {
  return (
    <>
      <Text style={styles.pageTitle}>News from your shops</Text>
      {announcements.length === 0 && <Text style={styles.empty}>No announcements yet — check back soon.</Text>}
      {announcements.map((a) => (
        <View key={a.id} style={styles.newsCard}>
          <Text style={styles.announcementFrom}>{a.business?.name || 'The Loyalty Loop team'}</Text>
          <Text style={styles.newsTitle}>{a.title}</Text>
          {!!a.body && <Text style={styles.description}>{a.body}</Text>}
          <Text style={styles.newsDate}>{new Date(a.created_at).toLocaleDateString()}</Text>
        </View>
      ))}
    </>
  )
}

// ---------------------------------------------------------------------
// Rewards tab
// ---------------------------------------------------------------------

function RewardsTab({ rewards }: { rewards: Reward[] }) {
  const active = rewards.filter((r) => !r.redeemed_at)
  return (
    <>
      <Text style={styles.pageTitle}>Ready to enjoy</Text>
      {active.length ? (
        active.map((reward) => (
          <View key={reward.id} style={styles.reward}>
            <Text style={styles.rewardShop}>{reward.business?.name || 'The Loyalty Loop shop'}</Text>
            <Text style={styles.rewardTitle}>{reward.title}</Text>
            <Text style={styles.muted}>Code: {reward.short_code}</Text>
            <View style={styles.rewardQr}>
              <QRCode value={`loyaltyloop:reward:${reward.qr_token}`} size={120} />
            </View>
          </View>
        ))
      ) : (
        <Text style={styles.empty}>Your unlocked rewards will appear here. Keep collecting!</Text>
      )}
    </>
  )
}

// ---------------------------------------------------------------------
// Favourites tab
// ---------------------------------------------------------------------

function FavouritesTab({
  favourites,
  memberships,
  onSelect,
  onQuickJoin,
}: {
  favourites: Business[]
  memberships: Membership[]
  onSelect: (business: Business) => void
  onQuickJoin: (business: Business) => void
}) {
  return (
    <>
      <Text style={styles.pageTitle}>Favourites</Text>
      {favourites.length === 0 && <Text style={styles.empty}>Tap the heart on a shop's page to save it here.</Text>}
      {favourites.map((b) => {
        const member = memberships.some((m) => m.business_id === b.id)
        return (
          <View key={b.id} style={styles.favouriteCard}>
            <View style={styles.favouriteTopRow}>
              {b.logo_url ? (
                <Image source={{ uri: b.logo_url }} style={styles.favouriteLogo} />
              ) : (
                <View style={[styles.favouriteLogo, { backgroundColor: b.brand_color || ink }]}>
                  <Text style={styles.logoLetter}>{b.name[0]}</Text>
                </View>
              )}
            </View>
            <Text style={styles.shopName}>{b.name}</Text>
            <Text style={styles.categoryLabel}>{(b.category || 'Local business').toUpperCase()}</Text>
            <View style={styles.favouriteDivider} />
            <View style={styles.favouriteBottomRow}>
              {member ? (
                <Text style={styles.favouriteStatus}>Member</Text>
              ) : (
                <Pressable onPress={() => onQuickJoin(b)} style={styles.favouriteTapRow}>
                  <View style={[styles.favouriteDot, { backgroundColor: b.brand_color || primary }]} />
                  <Text style={styles.favouriteStatus}>Tap to join</Text>
                </Pressable>
              )}
              <Pressable onPress={() => onSelect(b)} style={styles.favouriteViewRow}>
                <Text style={styles.favouriteViewText}>View</Text>
                <ArrowRightIcon />
              </Pressable>
            </View>
          </View>
        )
      })}
    </>
  )
}

// ---------------------------------------------------------------------
// Bottom tab bar
// ---------------------------------------------------------------------

const TABS: { id: Tab; label: string; icon: (active: boolean) => React.ReactNode }[] = [
  { id: 'home', label: 'Home', icon: (active) => <HomeIcon color={active ? primary : foreground} /> },
  { id: 'map', label: 'Map', icon: (active) => <MapPinIcon color={active ? primary : foreground} /> },
  { id: 'news', label: 'News', icon: (active) => <MegaphoneIcon color={active ? primary : foreground} /> },
  { id: 'rewards', label: 'Rewards', icon: (active) => <GiftIcon color={active ? primary : foreground} /> },
  { id: 'favourites', label: 'Favourites', icon: (active) => <HeartIcon color={active ? primary : foreground} filled={active} /> },
]

function BottomTabBar({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  return (
    <View style={styles.tabs}>
      {TABS.map(({ id, label, icon }) => {
        const active = tab === id
        return (
          <Pressable key={id} style={styles.tab} onPress={() => onChange(id)}>
            {icon(active)}
            <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

// ---------------------------------------------------------------------
// App home — orchestrates data + tabs
// ---------------------------------------------------------------------

function AppHome({ session }: { session: Session }) {
  const [tab, setTab] = useState<Tab>('home')
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [rewards, setRewards] = useState<Reward[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [favouriteIds, setFavouriteIds] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Business | null>(null)
  const [showProfile, setShowProfile] = useState(false)
  const [loading, setLoading] = useState(true)
  const userId = session.user.id

  const load = async () => {
    setLoading(true)
    try {
      const [shops, memberRows, earned, news, favs] = await Promise.all([
        supabase.from('businesses').select('*').eq('is_active', true).order('created_at'),
        supabase.from('memberships').select('*').eq('user_id', userId),
        supabase
          .from('rewards')
          .select('id,user_id,business_id,title,qr_token,short_code,expires_at,redeemed_at,created_at,business:businesses(name,brand_color,logo_url)')
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
        supabase
          .from('announcements')
          .select('id,business_id,title,body,is_active,created_at,business:businesses(name,brand_color,logo_url)')
          .eq('is_active', true)
          .order('created_at', { ascending: false }),
        supabase.from('favourites').select('business_id').eq('user_id', userId),
      ])
      if (shops.error) throw shops.error
      if (memberRows.error) throw memberRows.error
      if (earned.error) throw earned.error
      if (news.error) throw news.error
      if (favs.error) throw favs.error
      setBusinesses(shops.data || [])
      setMemberships(memberRows.data || [])
      setRewards((earned.data || []).map((r: any) => ({ ...r, business: Array.isArray(r.business) ? r.business[0] : r.business })))
      setAnnouncements((news.data || []).map((a: any) => ({ ...a, business: Array.isArray(a.business) ? a.business[0] : a.business })))
      setFavouriteIds(new Set((favs.data || []).map((row: any) => row.business_id as string)))
    } catch (e) {
      Alert.alert('Could not refresh', e instanceof Error ? e.message : 'Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function toggleFavourite(business: Business) {
    const isFav = favouriteIds.has(business.id)
    try {
      if (isFav) {
        const { error } = await supabase.from('favourites').delete().eq('user_id', userId).eq('business_id', business.id)
        if (error) throw error
        setFavouriteIds((prev) => {
          const next = new Set(prev)
          next.delete(business.id)
          return next
        })
      } else {
        const { error } = await supabase.from('favourites').insert({ user_id: userId, business_id: business.id })
        if (error) throw error
        setFavouriteIds((prev) => new Set(prev).add(business.id))
      }
    } catch (e) {
      Alert.alert('Could not update favourites', e instanceof Error ? e.message : 'Please try again.')
    }
  }

  async function quickJoin(business: Business) {
    try {
      const { error } = await supabase.from('memberships').upsert({ user_id: userId, business_id: business.id }, { onConflict: 'user_id,business_id' })
      if (error) throw error
      await load()
    } catch (e) {
      Alert.alert('Could not join', e instanceof Error ? e.message : 'Please try again.')
    }
  }

  const favouriteBusinesses = businesses.filter((b) => favouriteIds.has(b.id))

  if (selected) {
    return (
      <ShopDetail
        business={selected}
        userId={userId}
        membership={memberships.find((m) => m.business_id === selected.id)}
        favourite={favouriteIds.has(selected.id)}
        onBack={() => setSelected(null)}
        onToggleFavourite={() => toggleFavourite(selected)}
        refresh={load}
      />
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <AppHeader onOpenProfile={() => setShowProfile(true)} />
      <ScrollView contentContainerStyle={styles.screen} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={primary} />}>
        {tab === 'home' && <HomeTab businesses={businesses} announcements={announcements} onSelect={setSelected} />}
        {tab === 'map' && <MapTab businesses={businesses} onSelect={setSelected} />}
        {tab === 'news' && <NewsTab announcements={announcements} />}
        {tab === 'rewards' && <RewardsTab rewards={rewards} />}
        {tab === 'favourites' && (
          <FavouritesTab favourites={favouriteBusinesses} memberships={memberships} onSelect={setSelected} onQuickJoin={quickJoin} />
        )}
      </ScrollView>
      <BottomTabBar tab={tab} onChange={setTab} />
      {showProfile && <ProfileSheet session={session} userId={userId} onClose={() => setShowProfile(false)} />}
    </SafeAreaView>
  )
}

// ---------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------

export default function App() {
  return (
    <SafeAreaProvider>
      <AppRoot />
    </SafeAreaProvider>
  )
}

function AppRoot() {
  const [session, setSession] = useState<Session | null>(null)
  const [checking, setChecking] = useState(true)
  const [allowed, setAllowed] = useState(false)
  const [showAuth, setShowAuth] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setChecking(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) {
      setAllowed(false)
      return
    }
    ;(async () => {
      await supabase.rpc('ensure_current_user_bootstrap')
      const { data } = await supabase.from('user_roles').select('role').eq('user_id', session.user.id)
      const ok = isShopper((data || []).map((row: any) => row.role))
      setAllowed(ok)
      if (!ok) {
        Alert.alert('Use the business app', 'This account is an owner or staff account. Please sign in to The Loyalty Loop for Business instead.')
        await supabase.auth.signOut()
      }
    })()
  }, [session?.user.id])

  if (!hasSupabaseConfig) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.auth}>
          <Text style={styles.hero}>App configuration needed</Text>
          <Text style={styles.copy}>This build needs its Expo Supabase environment variables before it can connect.</Text>
        </View>
      </SafeAreaView>
    )
  }
  if (checking || (session && !allowed)) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={primary} />
        </View>
      </SafeAreaView>
    )
  }
  return session ? <AppHome session={session} /> : showAuth ? <AuthScreen onSession={setSession} /> : <ShopperLanding onContinue={() => setShowAuth(true)} />
}

// ---------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: background },
  auth: { flexGrow: 1, padding: 28, justifyContent: 'center' },
  screen: { padding: 20, paddingBottom: 130 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  mark: { width: 64, height: 64, borderRadius: 18, backgroundColor: card, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)', alignItems: 'center', justifyContent: 'center', marginBottom: 28, overflow: 'hidden' },
  markImage: { width: 46, height: 46, resizeMode: 'contain' },

  eyebrow: { color: primary, fontWeight: '800', fontSize: 12, letterSpacing: 1.5, marginBottom: 10 },
  hero: { color: foreground, fontSize: 36, fontWeight: '800', lineHeight: 42, letterSpacing: -1 },
  title: { color: foreground, fontSize: 26, fontWeight: '800', lineHeight: 31, letterSpacing: -0.5 },
  copy: { color: '#5c564c', fontSize: 16, lineHeight: 24, marginTop: 16 },
  description: { color: '#5c564c', fontSize: 15, lineHeight: 22, marginTop: 8 },
  landingTitle: { color: foreground, fontSize: 16, fontWeight: '800', marginTop: 3 },
  landingCopy: { color: '#5c564c', fontSize: 13, lineHeight: 19, marginBottom: 8 },

  card: { backgroundColor: card, borderRadius: 20, padding: 18, marginTop: 26, gap: 12, shadowColor: '#1a1a1a', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  input: { backgroundColor: '#f4efe4', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, color: foreground, fontSize: 16 },

  button: { backgroundColor: primary, borderRadius: 999, alignItems: 'center', padding: 15, marginTop: 2 },
  buttonSecondary: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: foreground, marginTop: 18 },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  buttonTextSecondary: { color: foreground },
  disabled: { opacity: 0.55 },
  link: { color: primary, textAlign: 'center', fontWeight: '700', marginTop: 8 },
  small: { color: '#8a8378', fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 22 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 6, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' },
  headerBrand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerLogo: { width: 32, height: 32, borderRadius: 8 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: foreground },
  headerProfileButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: card },

  pageTitle: { fontSize: 26, fontWeight: '800', color: foreground, letterSpacing: -0.5, marginBottom: 16, marginTop: 4 },

  // Category pills
  pillRow: { gap: 8, paddingBottom: 22 },
  pill: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.1)', backgroundColor: card },
  pillActive: { backgroundColor: primary, borderColor: primary },
  pillText: { fontSize: 13, fontWeight: '700', color: foreground },
  pillTextActive: { color: '#fff' },

  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  sectionEyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1, color: '#8a8378' },
  sparkle: { color: primary, fontSize: 13 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: foreground },

  // Announcements
  announcementRow: { gap: 12, paddingBottom: 26 },
  announcementCard: { width: 240, backgroundColor: card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' },
  announcementBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(232,112,59,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  announcementFrom: { fontSize: 11, fontWeight: '700', color: '#8a8378', textTransform: 'uppercase', letterSpacing: 0.4 },
  announcementTitle: { fontSize: 15, fontWeight: '800', color: foreground, marginTop: 4 },
  announcementBody: { fontSize: 13, color: '#5c564c', marginTop: 4, lineHeight: 18 },

  // Trending grid
  trendingGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  trendingCard: { width: '47%', borderRadius: 18, backgroundColor: card, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' },
  trendingCover: { height: 90, width: '100%' },
  trendingContent: { padding: 12 },
  trendingName: { fontSize: 14, fontWeight: '800', color: foreground },

  // Nearby list
  nearbyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: card, borderRadius: 16, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' },
  nearbyLogo: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  logoLetter: { color: '#fff', fontWeight: '800', fontSize: 17 },
  shopName: { fontSize: 15, fontWeight: '800', color: foreground },
  muted: { color: '#8a8378', fontSize: 12.5, lineHeight: 18, marginTop: 2 },
  empty: { color: '#8a8378', fontSize: 15, lineHeight: 22, marginTop: 12 },

  // Map
  mapWebviewWrap: { height: 320, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', marginBottom: 20 },
  mapPlaceholder: { backgroundColor: card, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', padding: 22, alignItems: 'center', gap: 10, marginBottom: 20 },
  mapPlaceholderText: { textAlign: 'center', color: '#5c564c', fontSize: 13.5, lineHeight: 19 },

  // News
  newsCard: { backgroundColor: card, borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' },
  newsTitle: { fontSize: 16, fontWeight: '800', color: foreground, marginTop: 4 },
  newsDate: { color: '#a39c8f', fontSize: 11, marginTop: 8 },

  // Shop detail
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 18 },
  back: { color: foreground, fontWeight: '700', fontSize: 15 },
  detailCover: { height: 190, width: '100%', borderRadius: 22, overflow: 'hidden', marginBottom: 18 },
  favouriteButton: { position: 'absolute', top: 14, right: 14, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },

  joinCard: { backgroundColor: card, borderRadius: 22, padding: 26, marginTop: 20, alignItems: 'center' },
  joinTitle: { fontSize: 19, fontWeight: '800', color: foreground, textAlign: 'center', marginBottom: 12 },
  rewardPill: { backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, marginBottom: 10 },
  rewardPillText: { fontSize: 11, fontWeight: '700', color: '#6b6459' },
  rewardTitleLarge: { fontSize: 19, fontWeight: '800', color: foreground, textAlign: 'center' },
  rewardTierList: { alignSelf: 'stretch', gap: 8, marginTop: 2 },
  rewardTier: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f4efe4', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  rewardTierThreshold: { color: foreground, fontSize: 13, fontWeight: '800' },
  rewardTierTitle: { color: foreground, fontSize: 15, fontWeight: '700', flex: 1, textAlign: 'right', marginLeft: 14 },

  loyaltyCard: { backgroundColor: card, borderRadius: 22, padding: 20, marginTop: 20, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' },
  loyaltyCardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  loyaltyCardCount: { fontSize: 13, fontWeight: '700', color: '#6b6459' },
  bar: { height: 9, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.07)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 6 },
  qrWrap: { alignItems: 'center', marginTop: 20 },
  qrText: { color: '#6b6459', fontWeight: '600', fontSize: 12.5, marginTop: 12 },
  walletButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1a1a1a', borderRadius: 999, height: 46, marginTop: 18 },
  walletButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Rewards
  reward: { backgroundColor: card, borderRadius: 20, padding: 20, marginTop: 4, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' },
  rewardShop: { color: primary, fontWeight: '800', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  rewardTitle: { color: foreground, fontSize: 21, fontWeight: '800', marginTop: 6 },
  rewardQr: { alignItems: 'center', marginTop: 16 },

  // Favourites
  favouriteCard: { backgroundColor: card, borderRadius: 20, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' },
  favouriteTopRow: { marginBottom: 12 },
  favouriteLogo: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  categoryLabel: { fontSize: 11, fontWeight: '700', color: '#8a8378', letterSpacing: 0.6, marginTop: 4 },
  favouriteDivider: { height: 1, backgroundColor: 'rgba(0,0,0,0.07)', marginVertical: 14 },
  favouriteBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  favouriteTapRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  favouriteDot: { width: 10, height: 10, borderRadius: 5 },
  favouriteStatus: { fontSize: 13.5, fontWeight: '700', color: foreground },
  favouriteViewRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  favouriteViewText: { color: primary, fontWeight: '800', fontSize: 13.5 },

  // Profile sheet
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: background, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 22, paddingTop: 10, paddingBottom: 24 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.15)', alignSelf: 'center', marginBottom: 16 },
  sheetHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sheetTitle: { fontSize: 13, fontWeight: '800', color: '#8a8378', letterSpacing: 0.6, textTransform: 'uppercase' },

  // Bottom tab bar
  tabs: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', backgroundColor: card, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.07)', paddingTop: 10, paddingBottom: 24 },
  tab: { flex: 1, alignItems: 'center', gap: 3 },
  tabText: { color: '#8a8378', fontWeight: '700', fontSize: 11 },
  tabTextActive: { color: primary },
})
