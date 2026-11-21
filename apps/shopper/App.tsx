import { CARD_FONTS } from "../../packages/card-design/fonts";
import { ShopBackdrop, ShopSkinProvider, shopSkin, skinStyles } from "../../packages/card-design/skin";
import { PassRow, ShopPass } from "../../packages/card-design/ShopPass";
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  AppState,
  BackHandler,
  Dimensions,
  FlatList,
  Image,
  Keyboard,
  Linking,
  PixelRatio,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import { CategoryCircles, HomeCollection, homeStyles } from './src/components/HomeCollection'
import { RewardCelebration, markRewardsSeen, unseenReward } from './src/components/RewardCelebration'
import { HomeFeed } from './src/components/HomeFeed'
import { AskWhirlSheet } from './src/components/AskWhirlSheet'
import { coarseNear } from './src/ask-whirl-core'
import { categoryCounts } from './src/home-rails'
import { SHOP_FEATURES, featureBadge, hasAllFeatures } from './src/shop-features'
import { fuzzyFilter } from './src/fuzzy-search'
import { useDebouncedValue } from './src/use-debounced-value'
import { formatAddress } from './src/format-address'
import { useLaunchUpdate } from './src/launch-update'
import { useUserLocation } from './src/use-user-location'
import { formatMiles, nearestFirst } from './src/distance'
import type { HomeTier } from './src/home-progress'
import { useQuickCards } from './src/quick-cards'
import { shopMoney } from './src/money'
import { useCountry } from './src/use-country'
import { ratingLabel, ratingStats } from './src/ratings'
import { KeyboardAwareScrollView } from './src/components/KeyboardAware'
import { SkeletonBlock, SkeletonScreen } from './src/components/Skeleton'
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated'
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps'
import Svg, { Circle, Path } from 'react-native-svg'
import { Whirl, AppWhirlProvider } from './src/Whirl'
import { WhirlSpinner, WhirlRefreshIndicator, whirlRefreshControlProps, useWhirlSettings, useWhirlStorage, shouldShowOnce, markSeen } from '../../packages/whirl/native'
import { LinearGradient } from 'expo-linear-gradient'
import Constants from 'expo-constants'
import * as Updates from 'expo-updates'
import * as Notifications from 'expo-notifications'
import QRCode from 'react-native-qrcode-svg'
import type { Session } from '@supabase/supabase-js'
import { useFonts, BricolageGrotesque_600SemiBold, BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque'
import { Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold } from '@expo-google-fonts/inter'
import { InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif'
import { AppIntro } from './src/components/Poster'
import { colors, fonts, ThemeProvider, useTheme, statusBarStyle } from './src/theme'
import { encodeRewardQr } from './src/reward-qr'
import { hasSupabaseConfig, readStoredSession, supabase } from './src/supabase'
import { clearLaunchCache, launchCacheTicket, readLaunchCache, writeLaunchCache } from './src/launch-cache'
import { isSessionRejection } from './src/launch-cache-core'
import { OutageBanner, setSimulatedOutage, simulatedOutage, useServiceStatus } from './src/service-status'
import { clearHomeCache, readHomeCache, writeHomeCache } from './src/home-cache'
import { biometricLockEnabled, setBiometricLock, unlockWithBiometrics } from './src/biometric'
import { pushPermission, registerPushToken } from './src/push'
import * as SecureStore from 'expo-secure-store'
import { GuestHome, type GuestShop } from './src/components/GuestHome'
import { Tip } from './src/components/Tip'
import { CardGrowOverlay, markCardOrigin, type CardGrowHandle } from './src/components/CardGrow'
import { disableWalkPast, enableWalkPast, refreshWalkPast, walkPastEnabled, walkPastSupported } from './src/walk-past'
import { addPassFromBase64 } from './modules/expo-wallet-pass'
import { haptic, getHapticsEnabled, setHapticsEnabled } from './src/haptics'
import { signInWithGoogle } from './src/google-auth'
import { signInWithApple, signInWithAppleWeb } from './src/apple-auth'
import * as AppleAuthentication from 'expo-apple-authentication'
import { getUsageAnalyticsConsent, setUsageAnalyticsConsent, trackUsageEvent } from './src/usage-analytics'
import { syncShopperWidget } from './src/widgets/state'
import { Sheet } from './src/components/Sheet'
import { AppAlertHost, showAlert } from './src/components/AppAlert'
import { EmailCodeStep } from './src/components/EmailCodeStep'
import { codeErrorMessage, isExistingAccount, isUnconfirmedEmail } from './src/email-code'
import { SuccessCheck } from './src/components/SuccessCheck'
import { ReceiptPrinter, type ReceiptData } from './src/components/ReceiptPrinter'
import { StampThump } from './src/components/StampThump'
import { Ticket } from './src/components/Ticket'
import { HowItWorks, OpeningHoursList, openStatus, type OpeningHours, type TierRow } from './src/shop-profile'
import { pointsStanding, programmeIdFor, tierStanding, unitNames } from '@loyalty-loop/loyalty'
import { AskShopSheet, RequestedShopsSheet } from './src/components/ShopRequests'
import { trendingShops } from './src/trending'
import { cardLabel, useCardLinking, type CardLinking, type LinkedCard, type LinkOutcome } from './src/card-linking'
import { ExternalCards } from './src/components/ExternalCards'
import logo from './assets/brand/loyalty-loop-mark.png'
import { schemeColor, themed } from '@loyalty-loop/design-tokens'

const FONT_DISPLAY = fonts.nativeDisplay



// ---------------------------------------------------------------------
// Icons — small, consistent line icons (stroke-based, 2px, round caps)
// matching the web app's lucide-react icon language without adding a
// native icon-library dependency.
// ---------------------------------------------------------------------

type IconProps = { color?: string; size?: number; filled?: boolean }

function HomeIcon({ color = colors.foreground, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 11.5 12 4l9 7.5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M5.5 10v9a1 1 0 0 0 1 1H10v-6h4v6h3.5a1 1 0 0 0 1-1v-9" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

function MapPinIcon({ color = colors.foreground, size = 22 }: IconProps) {
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

function MegaphoneIcon({ color = colors.foreground, size = 22 }: IconProps) {
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

function GiftIcon({ color = colors.foreground, size = 22 }: IconProps) {
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

function HeartIcon({ color = colors.foreground, size = 22, filled = false }: IconProps) {
  const d = 'M12 21s-7.8-4.7-10.2-9.4C.3 8.2 2.4 4.5 6.2 4.5c2.2 0 4 1.3 5.8 3.6 1.8-2.3 3.6-3.6 5.8-3.6 3.8 0 5.9 3.7 4.4 7.1C19.8 16.3 12 21 12 21z'
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={d} stroke={color} strokeWidth={2} strokeLinejoin="round" fill={filled ? color : 'none'} />
    </Svg>
  )
}

function SearchIcon({ color = colors.foreground, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={6.5} stroke={color} strokeWidth={2.2} />
      <Path d="m16 16 4.5 4.5" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  )
}

// White, outlined search field so it stands out from the cream page background.
function SearchBar({ value, onChangeText, accessibilityLabel, autoFocus, floating, placeholder = 'Search shops' }: { value: string; onChangeText: (v: string) => void; accessibilityLabel: string; autoFocus?: boolean; floating?: boolean; placeholder?: string }) {
  return (
    <View style={[styles.searchBar, floating && styles.searchBarFloating]}>
      <SearchIcon color={colors.foreground} size={20} />
      <TextInput accessibilityLabel={accessibilityLabel} placeholder={placeholder} placeholderTextColor={floating ? schemeColor('#6B6A66', 'fg') : schemeColor('#000000', 'fg')} value={value} onChangeText={onChangeText} style={styles.searchInput} returnKeyType="search" autoCorrect={false} autoFocus={autoFocus} />
      {value.length > 0 && (
        <Pressable accessibilityLabel="Clear search" onPress={() => onChangeText('')} hitSlop={10}>
          <CloseIcon color={schemeColor("#8A857C", 'fg')} size={16} />
        </Pressable>
      )}
    </View>
  )
}

function UserIcon({ color = colors.foreground, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={3.6} stroke={color} strokeWidth={2} />
      <Path d="M4.5 20c0-4 3.5-6.5 7.5-6.5s7.5 2.5 7.5 6.5" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  )
}

function ChevronLeftIcon({ color = colors.foreground, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M15 5.5 8.5 12l6.5 6.5" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

function ArrowRightIcon({ color = colors.primary, size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 12h16M13 5.5 19.5 12 13 18.5" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

function ArrowLeftIcon({ color = '#fff', size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 12H4M11 5.5 4.5 12 11 18.5" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

function CloseIcon({ color = colors.foreground, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 6l12 12M18 6 6 18" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  )
}

function ChevronRightIcon({ color = colors.foreground, size = 22 }: IconProps) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M9 6l6 6-6 6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>
}
function QrIcon({ color = colors.foreground, size = 18 }: IconProps) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM18 18h3v3h-3zM14 21h1M21 14v1" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>
}
function LockIcon({ color = colors.foreground, size = 18 }: IconProps) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M7 11V8a5 5 0 0110 0v3M5 11h14v10H5z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>
}
function ChartIcon({ color = colors.foreground, size = 18 }: IconProps) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M5 20v-7M11 20V5M17 20v-10M2 20h20" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>
}
function BanIcon({ color = colors.foreground, size = 18 }: IconProps) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} /><Path d="M5.7 5.7l12.6 12.6" stroke={color} strokeWidth={2} strokeLinecap="round" /></Svg>
}
function BellIcon({ color = colors.foreground, size = 18 }: IconProps) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M6 16v-5a6 6 0 0112 0v5l2 2H4l2-2zM10 21h4" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>
}
function HelpIcon({ color = colors.foreground, size = 18 }: IconProps) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} /><Path d="M9.5 9.5a2.5 2.5 0 015 0c0 1.6-2.5 2-2.5 3.6M12 17h.01" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>
}
function MailIcon({ color = colors.foreground, size = 18 }: IconProps) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M3 5h18v14H3zM3 7l9 6 9-6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>
}
function DocIcon({ color = colors.foreground, size = 18 }: IconProps) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M6 2h8l5 5v15H6zM14 2v5h5M9 13h6M9 17h6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>
}
function LogOutIcon({ color = colors.foreground, size = 18 }: IconProps) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M10 17l5-5-5-5M15 12H3M13 3h6v18h-6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>
}
function TrashIcon({ color = colors.foreground, size = 18 }: IconProps) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>
}
function CardIcon({ color = colors.foreground, size = 18 }: IconProps) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M3 6h18v12H3zM3 10h18M7 15h3" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>
}
function MoonIcon({ color = colors.foreground, size = 18 }: IconProps) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>
}
function SmileIcon({ color = colors.foreground, size = 18 }: IconProps) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} /><Path d="M8.5 14a4 4 0 0 0 7 0M9 9.5h.01M15 9.5h.01" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>
}
function GlobeIcon({ color = colors.foreground, size = 18 }: IconProps) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} /><Path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" stroke={color} strokeWidth={2} strokeLinejoin="round" /></Svg>
}
function BoltIcon({ color = colors.foreground, size = 14 }: IconProps) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M13 2L4.5 13.5H11L10 22l8.5-11.5H12L13 2z" fill={color} /></Svg>
}

function GoogleIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
      <Path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.1 18.9 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <Path fill="#4CAF50" d="M24 44c5.4 0 10.3-1.8 14.1-5l-6.5-5.5C29.5 35.4 26.9 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 39.7 16.3 44 24 44z" />
      <Path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.3-4.1 5.7l6.5 5.5C39.6 37 44 31 44 24c0-1.3-.1-2.7-.4-3.5z" />
    </Svg>
  )
}

function AppleIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size * 1.2} viewBox="0 0 384 512">
      <Path
        fill="#fff"
        d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5c0 26.2 4.8 53.3 14.4 81.2 12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"
      />
    </Svg>
  )
}

function ReelsIcon({ color = colors.foreground, size = 22, filled = false }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 4.5h16a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        fill={filled ? color : 'none'}
      />
      <Path d="M10 9.2v5.6l5-2.8-5-2.8z" fill={filled ? colors.background : color} />
    </Svg>
  )
}

function ShareIcon({ color = '#fff', size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3v12" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M8 7l4-4 4 4" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

function CheckBadgeIcon({ color = colors.primary, size = 14 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} fill={color} />
      <Path d="M7.5 12.5l3 3 6-6.5" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
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
  country_code?: string | null
  rating_avg?: number | null
  rating_count?: number | null
  category?: string | null
  description?: string | null
  address?: string | null
  lat?: number | null
  lng?: number | null
  website?: string | null
  phone?: string | null
  instagram?: string | null
  tiktok?: string | null
  youtube?: string | null
  brand_color?: string
  card_design?: unknown
  logo_url?: string | null
  cover_url?: string | null
  opening_hours?: OpeningHours | null
  loyalty_type?: string
  loyalty_config?: { stamps_required?: number; points_per_pound?: number }
  reward_model?: 'stamp_legacy' | 'spend_threshold' | 'tiers' | 'points'
  reward_threshold_pence?: number | null
  features?: string[] | null
  halal_certifier?: string | null
  trending?: boolean | null
  trending_position?: number | null
}
type Membership = {
  business_id: string
  stamp_count: number
  points_balance: number
  promos_opted_out?: boolean | null
  reward_progress_pence?: number | null
  redemption_blocked_reason?: string | null
  current_tier?: string | null
  current_tier_id?: string | null
}
// Amounts show in the shop's own currency (see src/money.ts).
const pounds = (pence: number, countryCode?: string | null) => shopMoney(countryCode)(pence)
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
  spend_threshold_pence?: number | null
  points_cost?: number | null
}
type ReviewReply = { body: string; created_at: string }
type ShopReview = {
  id: string
  user_id: string
  rating: number
  body?: string | null
  created_at: string
  // One reply per review; PostgREST may return it as an object or a one-item list.
  reply?: ReviewReply | ReviewReply[] | null
}
const reviewReply = (review: ShopReview): ReviewReply | null =>
  Array.isArray(review.reply) ? review.reply[0] ?? null : review.reply ?? null
type BusinessPhoto = { id: string; url: string; sort_order: number }
type GalleryPhoto = {
  id: string
  url: string
  created_at: string
  business: Business
}
type Announcement = {
  id: string
  title: string
  body: string | null
  created_at: string
  business: { name: string; brand_color?: string; logo_url?: string | null } | null
}
type Tab = 'home' | 'discover' | 'map' | 'news' | 'rewards' | 'favourites'
type PlatformNotice = { id: string; title: string; body: string | null }

const isShopper = (roles: string[]) =>
  roles.includes('consumer') && !roles.some((role) => ['business_owner', 'staff', 'brand_head'].includes(role))

// A light first-pass filter that stops the most clearly objectionable review
// text from being posted at all. It is deliberately small and conservative —
// the report + moderator queue is the real safety net for anything borderline.
const BLOCKED_LANGUAGE = ['nigger', 'faggot', 'retard', 'kike', 'chink', 'spic', 'tranny', 'kill yourself', 'kys ']
function containsBlockedLanguage(text: string) {
  const normalised = text.toLowerCase().replace(/[^a-z ]+/g, '')
  return BLOCKED_LANGUAGE.some((term) => normalised.includes(term))
}

// ---------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------

function Button({ title, onPress, secondary, disabled }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.buttonSecondary, disabled && styles.disabled, pressed && styles.pressed]}>
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
      <Pressable accessibilityRole="button" accessibilityLabel="Your profile and settings" onPress={onOpenProfile} hitSlop={10} style={styles.headerProfileButton}>
        <UserIcon />
      </Pressable>
    </View>
  )
}

// ---------------------------------------------------------------------
// Onboarding / auth
// ---------------------------------------------------------------------

/** A card the shopper tapped Join on before they had an account. It is joined
 * as soon as they sign in, so the tap is never lost. */
let pendingJoin: GuestShop | null = null

function AuthScreen({ onSession, onBack, reason, initialMode = 'signIn' }: { onSession: (session: Session) => void; onBack?: () => void; reason?: string; initialMode?: 'signIn' | 'signUp' }) {
  const [mode, setMode] = useState<'signIn' | 'signUp'>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  // Waiting for the code from the confirmation email.
  const [codeFor, setCodeFor] = useState<string | null>(null)

  async function confirmEmailFirst(address: string) {
    const { error } = await supabase.auth.resend({ type: 'signup', email: address })
    // Even if a code went out a moment ago (rate limit), the step lets them type it.
    if (error && !/security purposes|rate limit/i.test(error.message)) return showAlert('Could not sign in', codeErrorMessage(error.message))
    setCodeFor(address)
  }

  async function submit() {
    if (!email.trim() || password.length < 6 || (mode === 'signUp' && !name.trim())) {
      return showAlert('Check your details', 'Enter your name, email and a password of at least 6 characters.')
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
        if (data.session) { haptic.success(); onSession(data.session) }
        else if (isExistingAccount(data.user)) {
          // Supabase sends nothing to an address that already has an account.
          setMode('signIn')
          showAlert('You already have an account', `Sign in with ${email.trim()} and your password.`)
        } else setCodeFor(email.trim())
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) {
          if (isUnconfirmedEmail(error.message)) return void (await confirmEmailFirst(email.trim()))
          throw error
        }
        haptic.success()
        onSession(data.session)
      }
    } catch (e) {
      showAlert('Could not continue', e instanceof Error ? e.message : 'Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function submitGoogle() {
    setBusy(true)
    try {
      const session = await signInWithGoogle()
      if (session) { haptic.success(); onSession(session) }
    } catch (e) {
      showAlert('Could not sign in with Google', e instanceof Error ? e.message : 'Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function submitApple() {
    setBusy(true)
    try {
      const session = await signInWithApple()
      if (session) { haptic.success(); onSession(session) }
    } catch (e) {
      // The user cancelling the Apple sheet isn't an error worth alerting on.
      if (e instanceof Error && e.message.includes('ERR_REQUEST_CANCELED')) return
      showAlert('Could not sign in with Apple', e instanceof Error ? e.message : 'Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function submitAppleWeb() {
    setBusy(true)
    try {
      const session = await signInWithAppleWeb()
      if (session) { haptic.success(); onSession(session) }
    } catch (e) {
      showAlert('Could not sign in with Apple', e instanceof Error ? e.message : 'Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAwareScrollView contentContainerStyle={styles.auth} keyboardShouldPersistTaps="handled">
        {onBack ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Back to shops" onPress={onBack} hitSlop={12} style={{ alignSelf: 'flex-start', paddingVertical: 8, marginBottom: 8 }}>
            <ChevronLeftIcon size={26} />
          </Pressable>
        ) : null}
        {codeFor ? (
          <EmailCodeStep
            email={codeFor}
            title={name.trim() ? `Nearly there, ${name.trim()}.` : 'Check your email'}
            intro="Type it here and your first stamp is waiting."
            onVerified={onSession}
            onChangeEmail={() => setCodeFor(null)}
          />
        ) : (
        <>
        <View style={styles.mark}>
          <Image source={logo} style={styles.markImage} />
        </View>
        <Text style={styles.eyebrow}>The Loyalty Loop</Text>
        {mode === 'signUp' && <Whirl pose={reason ? 'thumbs' : 'wave'} size={104} style={{ alignSelf: 'flex-start', marginBottom: 4 }} />}
        <Text style={styles.hero}>{reason ? 'Save your card' : mode === 'signUp' ? 'Your local shops want to say thanks.' : 'Welcome back'}</Text>
        <Text style={styles.copy}>{reason ?? (mode === 'signUp' ? 'A free account keeps your stamps and rewards in one place. Nothing to carry, nothing to lose in a coat pocket.' : 'Sign in to see your cards and rewards.')}</Text>
        <View style={styles.card}>
          {Platform.OS === 'ios' ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={12}
              style={styles.appleButton}
              onPress={submitApple}
            />
          ) : (
            <Pressable onPress={submitAppleWeb} disabled={busy} style={[styles.appleButton, styles.appleButtonAndroid]}>
              <AppleIcon />
              <Text style={styles.appleButtonText}>Continue with Apple</Text>
            </Pressable>
          )}
          <Pressable onPress={submitGoogle} disabled={busy} style={styles.googleButton}>
            <GoogleIcon />
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          </Pressable>
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>
          {mode === 'signUp' && (
            <TextInput value={name} onChangeText={setName} placeholder="First name" placeholderTextColor={schemeColor("#000000", 'fg')} style={styles.input} autoCapitalize="words" />
          )}
          <TextInput value={email} onChangeText={setEmail} placeholder="Email address" placeholderTextColor={schemeColor("#000000", 'fg')} style={styles.input} keyboardType="email-address" autoCapitalize="none" />
          <TextInput value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor={schemeColor("#000000", 'fg')} style={styles.input} secureTextEntry />
          <Button title={busy ? 'Please wait…' : mode === 'signIn' ? 'Sign in' : 'Let’s go'} onPress={submit} disabled={busy} />
          <Pressable onPress={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}>
            <Text style={styles.link}>{mode === 'signIn' ? 'New here? Make an account' : 'Been here before? Sign in'}</Text>
          </Pressable>
        </View>
        <Text style={styles.small}>Business or staff account? Use The Loyalty Loop for Business app.</Text>
        <Pressable onPress={() => void Linking.openURL('https://www.the-loyalty-loop.com/help')} style={styles.authHelpLink}>
          <Text style={styles.authHelpLinkText}>Help &amp; FAQ</Text>
        </Pressable>
        </>
        )}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  )
}

// ---------------------------------------------------------------------
// Profile sheet (opened from the header icon)
// ---------------------------------------------------------------------

/** Store-policy requirement: an app that creates accounts must let the user
 * delete the account in-app. The delete-my-account function removes the
 * shopper's memberships, stamps, rewards and reviews before the login. */
function confirmDeleteAccount() {
  const run = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('delete-my-account')
      if (error) throw error
      if (data && typeof data === 'object' && 'error' in data && data.error) throw new Error(String(data.error))
      await disableWalkPast().catch(() => undefined)
      await supabase.auth.signOut().catch(() => undefined)
      showAlert('Account deleted', 'Your account and its data have been permanently deleted.')
    } catch (e) {
      showAlert('Could not delete account', e instanceof Error ? e.message : 'Please try again.')
    }
  }
  showAlert(
    'Delete your account?',
    'This permanently deletes your login, loyalty cards, linked payment cards, stamps, rewards and reviews. This cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Continue',
        style: 'destructive',
        onPress: () =>
          showAlert('Are you absolutely sure?', 'There is no way to recover your account or rewards afterwards.', [
            { text: 'Keep my account', style: 'cancel' },
            { text: 'Delete everything', style: 'destructive', onPress: () => void run() },
          ]),
      },
    ],
  )
}

const WEB = 'https://www.the-loyalty-loop.com'
const openUrl = (url: string) => void Linking.openURL(url)

// Icon tile colours for settings rows: soft background + matching icon tint.
const TILES = themed(() => ({
  blue: { bg: schemeColor('#DBE7FF', 'bg'), fg: schemeColor('#2B3A67', 'fg') },
  purple: { bg: schemeColor('#F3E3D3', 'bg'), fg: schemeColor('#8A4A2B', 'fg') },
  rose: { bg: schemeColor('#F8DCCB', 'bg'), fg: schemeColor('#B5431C', 'fg') },
  amber: { bg: schemeColor('#FBE7BF', 'bg'), fg: schemeColor('#8A5A00', 'fg') },
  green: { bg: schemeColor('#DCEBD9', 'bg'), fg: schemeColor('#2F7A3F', 'fg') },
  teal: { bg: schemeColor('#D7E6E0', 'bg'), fg: schemeColor('#2E6656', 'fg') },
  slate: { bg: schemeColor('#EFEBE3', 'bg'), fg: schemeColor('#6F6B64', 'fg') },
  orange: { bg: schemeColor('#FDE2D2', 'bg'), fg: colors.primaryText },
  red: { bg: schemeColor('#f8dcd8', 'bg'), fg: schemeColor('#b54439', 'fg') },
}) as const)
type Tile = keyof typeof TILES

function SettingsRow({ icon, tile = 'slate', title, detail, onPress, right, danger, last }: { icon: (color: string) => ReactNode; tile?: Tile; title: string; detail?: string; onPress?: () => void; right?: ReactNode; danger?: boolean; last?: boolean }) {
  const palette = TILES[danger ? 'red' : tile]
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.settingsRow, !last && styles.settingsRowBorder, pressed && onPress ? styles.settingsRowPressed : null]}>
      <View style={[styles.settingsIcon, { backgroundColor: palette.bg }]}>{icon(palette.fg)}</View>
      <View style={styles.settingsRowBody}>
        <Text style={[styles.settingsRowTitle, danger && styles.settingsRowTitleDanger]}>{title}</Text>
        {detail ? <Text style={styles.settingsRowDetail} numberOfLines={2}>{detail}</Text> : null}
      </View>
      {right ?? (onPress ? <ChevronRightIcon color={schemeColor("#A39E95", 'fg')} size={18} /> : null)}
    </Pressable>
  )
}

function SettingsGroup({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={styles.settingsGroup}>
      {title ? <Text style={styles.settingsGroupTitle}>{title}</Text> : null}
      <View style={styles.settingsCard}>{children}</View>
    </View>
  )
}

// 'Same as my phone' needs the next store build (userInterfaceStyle automatic); until then this installed app can't see the phone's setting, so only Light/Dark are offered.
const APPEARANCE_LABELS = { light: 'Light', dark: 'Dark', system: 'Light' } as const

type SettingsView = 'root' | 'card' | 'name' | 'blocked' | 'cards' | 'externalCards'
const SETTINGS_TITLES: Record<SettingsView, string> = { root: 'Your account', card: 'Your code', name: 'Your name', blocked: 'Blocked people', cards: 'Linked cards', externalCards: 'My other cards' }

/** Account pop-up: a bottom sheet with a brand hero (name + customer card), then
 * grouped rows — security & privacy → notifications → support → legal → account.
 * The card, the name editor and the blocked list open inside the same sheet. */
function SettingsSheet({ visible, session, userId, stampCode, onClose, initialView = 'root', cardLinking, onLinkCard, onViewRequested, country }: { country: ReturnType<typeof useCountry>; visible: boolean; session: Session; userId: string; stampCode: string | null; onClose: () => void; initialView?: SettingsView; cardLinking: CardLinking; onLinkCard: () => void; onViewRequested: (id:string) => void }) {
  const [view, setView] = useState<SettingsView>('root')
  const [showRequests, setShowRequests] = useState(false)
  const [biometricEnabled, setBiometricEnabled] = useState(false)
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false)
  const whirlSettings = useWhirlSettings()
  const [hapticsOn, setHapticsOn] = useState(true)
  const [walkPast, setWalkPast] = useState(false)
  const [walkPastBusy, setWalkPastBusy] = useState(false)
  const [blocks, setBlocks] = useState<{ blocked_id: string; created_at: string }[]>([])
  const firstName: string = session.user.user_metadata?.first_name || 'Shopper'
  const email = session.user.email || ''
  const [name, setName] = useState(session.user.user_metadata?.first_name || '')
  const [savingName, setSavingName] = useState(false)
  const theme = useTheme()
  const version = Constants.expoConfig?.version ?? '1.0.0'
  const updateLabel = Updates.updateId ? `update ${Updates.updateId.slice(0, 8)}` : 'store build'

  const loadBlocks = () => supabase.from('user_blocks').select('blocked_id,created_at').eq('blocker_id', userId).order('created_at', { ascending: false }).then(({ data }) => setBlocks(data || []))
  // The sheet now stays mounted between opens (Sheet owns the show/hide animation),
  // so refresh its data and reset to the root view each time it opens instead of on mount.
  useEffect(() => {
    if (!visible) return
    setView(initialView)
    setShowRequests(false)
    biometricLockEnabled().then(setBiometricEnabled)
    getUsageAnalyticsConsent().then(setAnalyticsEnabled)
    void getHapticsEnabled().then(setHapticsOn)
    void walkPastEnabled().then(setWalkPast)
    void loadBlocks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialView])

  // Opening Linked cards also stores any card Fidel enrolled that we never saved.
  useEffect(() => {
    if (visible && view === 'cards') void cardLinking.recover()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, view])

  function confirmRemoveCard(linkedCard: LinkedCard) {
    showAlert(`Remove ${cardLabel(linkedCard)}?`, 'You’ll stop earning automatically when you pay with this card. Progress you’ve already earned stays.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => void cardLinking.remove(linkedCard.linkedCardId).then((ok) => {
          if (!ok) showAlert('Couldn’t remove this card', 'Please try again.')
        }),
      },
    ])
  }

  async function unblock(blockedId: string) {
    const { error } = await supabase.from('user_blocks').delete().eq('blocker_id', userId).eq('blocked_id', blockedId)
    if (error) return showAlert('Could not unblock', error.message)
    void loadBlocks()
  }
  async function toggleBiometricLock(next: boolean) {
    const result = await setBiometricLock(next)
    if (!result.success) return showAlert('Could not update app lock', result.error)
    setBiometricEnabled(next)
  }
  async function toggleHaptics(next: boolean) { setHapticsOn(next); await setHapticsEnabled(next); if (next) haptic.reward() }
  async function toggleUsageAnalytics(next: boolean) { await setUsageAnalyticsConsent(next); setAnalyticsEnabled(next) }
  async function switchWalkPast(next: boolean) {
    setWalkPastBusy(true)
    try {
      if (!next) { await disableWalkPast(); setWalkPast(false); return }
      const result = await enableWalkPast()
      setWalkPast(result === 'on')
      if (result === 'needs_always') showAlert('Location needed all the time', Platform.OS === 'ios'
        ? 'Walk-past offers only work if location is set to "Always". You can change it in Settings > The Loyalty Loop > Location.'
        : 'Walk-past offers only work if location is set to "Allow all the time". You can change it in your phone settings.',
        [{ text: 'Not now', style: 'cancel' }, { text: 'Open settings', onPress: () => void Linking.openSettings() }])
      else if (result === 'needs_notifications') showAlert('Notifications are off', 'Turn on notifications for The Loyalty Loop to get walk-past offers.',
        [{ text: 'Not now', style: 'cancel' }, { text: 'Open settings', onPress: () => void Linking.openSettings() }])
      else if (result === 'failed') showAlert('Could not turn it on', 'Check your connection and try again.')
    } finally {
      setWalkPastBusy(false)
    }
  }
  function toggleWalkPast(next: boolean) {
    if (!next) return switchWalkPast(false)
    showAlert('Offers from shops you walk past?',
      "When you pass a shop you haven't joined that has an offer on, we'll send you one notification. At most one a day, never the same shop twice in a month, and only while it's open.\n\nYour phone needs to use your location in the background. Your location stays on your phone; we're only told which shop you passed. Turn it off here any time.",
      [{ text: 'Not now', style: 'cancel' }, { text: 'Turn on', onPress: () => void switchWalkPast(true) }])
  }
  async function saveName() {
    const trimmed = name.trim()
    if (!trimmed) return showAlert('Add your name', 'Enter the name you would like shops to see.')
    setSavingName(true)
    const { error } = await supabase.auth.updateUser({ data: { first_name: trimmed } })
    setSavingName(false)
    if (error) return showAlert('Could not save your name', error.message)
    setView('root')
  }
  function confirmSignOut() {
    showAlert('Sign out?', 'You can sign back in at any time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => { clearHomeCache(userId); void disableWalkPast().catch(() => undefined).finally(() => void supabase.auth.signOut()) } },
    ])
  }
  return (
    <Sheet visible={visible} onClose={onClose} sheetStyle={[styles.sheet, styles.settingsSheet]} dragArea="handle" dragAreaHeight={44}>
      <SafeAreaView edges={['bottom']}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeaderRow}>
          {view === 'root' ? (
            <Text style={styles.sheetTitle}>{SETTINGS_TITLES.root}</Text>
          ) : (
            <Pressable accessibilityRole="button" accessibilityLabel={`Back to ${SETTINGS_TITLES.root}`} onPress={() => setView('root')} hitSlop={10} style={styles.sheetBack}>
              <ChevronLeftIcon size={18} color={schemeColor("#8A857C", 'fg')} />
              <Text style={styles.sheetTitle}>{SETTINGS_TITLES[view]}</Text>
            </Pressable>
          )}
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={12}>
            <CloseIcon />
          </Pressable>
        </View>
        <KeyboardAwareScrollView pad={false} showsVerticalScrollIndicator={false} contentContainerStyle={styles.settingsSheetScroll} keyboardShouldPersistTaps="handled">
          {view === 'root' && (
            <>
              <LinearGradient colors={[colors.primary, schemeColor('#1F2A4D', 'bg')]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.settingsHero}>
                <Pressable onPress={() => setView('name')} style={styles.settingsHeroRow}>
                  <View style={styles.settingsHeroAvatar}><Text style={styles.settingsHeroAvatarText}>{initialsOf(firstName)}</Text></View>
                  <View style={styles.settingsRowBody}>
                    <Text style={styles.settingsHeroName}>{firstName}</Text>
                    <Text style={styles.settingsHeroEmail} numberOfLines={1}>{email}</Text>
                  </View>
                  <ChevronRightIcon color={schemeColor("rgba(255,255,255,0.85)", 'fg')} size={18} />
                </Pressable>
                <Pressable onPress={() => setView('card')} style={styles.settingsHeroButton}>
                  <View style={styles.settingsHeroButtonIcon}><QrIcon color={schemeColor("#fff", 'fg')} size={20} /></View>
                  <View style={styles.settingsRowBody}>
                    <Text style={styles.settingsHeroButtonTitle}>Show my code</Text>
                    <Text style={styles.settingsHeroButtonCopy}>Show it when you pay to earn rewards</Text>
                  </View>
                  <ChevronRightIcon color={colors.primaryText} size={18} />
                </Pressable>
              </LinearGradient>
              <SettingsGroup title="Other loyalty cards">
                <SettingsRow tile="green" icon={(c) => <CardIcon color={c} size={18} />} title="My other cards" detail="Show your other loyalty cards at the till" onPress={() => setView('externalCards')} last />
              </SettingsGroup>
              <SettingsGroup title="Shop requests">
                <SettingsRow tile="orange" icon={(c) => <MegaphoneIcon color={c} size={18} />} title="Shops you've asked for" detail="See progress or withdraw a request" onPress={() => setShowRequests(true)} last />
              </SettingsGroup>

              {cardLinking.enabled && (
                <SettingsGroup title="Payment cards">
                  <SettingsRow
                    tile="green"
                    icon={(c) => <CardIcon color={c} size={18} />}
                    title="Linked cards"
                    detail={cardLinking.cards.length ? `${cardLinking.cards.length} ${cardLinking.cards.length === 1 ? 'card' : 'cards'} linked` : 'Earn automatically when you pay'}
                    onPress={() => setView('cards')}
                    last
                  />
                </SettingsGroup>
              )}

              <SettingsGroup title="Appearance">
                <SettingsRow
                  tile="purple"
                  icon={(c) => <MoonIcon color={c} size={18} />}
                  title="Light or dark"
                  detail={APPEARANCE_LABELS[theme.preference]}
                  onPress={() =>
                    showAlert('Appearance', 'Choose how The Loyalty Loop looks. “Same as my phone” arrives with the next app update.', [
                      ...(['light', 'dark'] as const).map((option) => ({ text: ((theme.preference === option || (option === 'light' && theme.preference === 'system')) ? '✓ ' : '') + APPEARANCE_LABELS[option], onPress: () => theme.setPreference(option) })),
                      { text: 'Cancel', style: 'cancel' as const },
                    ])
                  }
                />
                <SettingsRow
                  tile="orange"
                  icon={(c) => <SmileIcon color={c} size={18} />}
                  title="Show Whirl"
                  detail="Our mascot on welcome screens, empty pages and rewards. Loading spinners stay."
                  right={<Switch value={whirlSettings.showWhirl} onValueChange={whirlSettings.setShowWhirl} trackColor={{ true: colors.primary }} />}
                  last
                />
              </SettingsGroup>

              {country.countries.length > 1 && <SettingsGroup title="Country">
                <SettingsRow
                  tile="teal"
                  icon={(c) => <GlobeIcon color={c} size={18} />}
                  title="Your country"
                  detail={`${country.country.name} · prices in ${country.country.currency_code}`}
                  onPress={() =>
                    showAlert('Where are you?', 'We show shops in your country.', [
                      ...country.countries.map((option) => ({ text: option.name, onPress: () => void country.setCountry(option.code) })),
                      { text: 'Cancel', style: 'cancel' as const },
                    ])
                  }
                  last
                />
              </SettingsGroup>}

              <SettingsGroup title="Security & privacy">
                <SettingsRow tile="blue" icon={(c) => <LockIcon color={c} size={18} />} title="App lock" detail="Face ID, Touch ID or fingerprint to open the app" right={<Switch value={biometricEnabled} onValueChange={(v) => void toggleBiometricLock(v)} trackColor={{ true: colors.primary }} />} />
                <SettingsRow tile="orange" icon={(c) => <BellIcon color={c} size={18} />} title="Haptics" detail="Vibrate when you earn stamps, rewards and more" right={<Switch value={hapticsOn} onValueChange={(v) => void toggleHaptics(v)} trackColor={{ true: colors.primary }} />} />
                <SettingsRow tile="purple" icon={(c) => <ChartIcon color={c} size={18} />} title="Anonymous analytics" detail="Helps us improve the app. Never your email, code or messages" right={<Switch value={analyticsEnabled} onValueChange={(v) => void toggleUsageAnalytics(v)} trackColor={{ true: colors.primary }} />} />
                <SettingsRow tile="rose" icon={(c) => <BanIcon color={c} size={18} />} title="Blocked people" detail={blocks.length ? `${blocks.length} blocked` : 'Nobody blocked'} onPress={() => setView('blocked')} last />
              </SettingsGroup>

              <SettingsGroup title="Notifications">
                {walkPastSupported() && <SettingsRow tile="teal" icon={(c) => <MapPinIcon color={c} size={18} />} title="Walk-past offers" detail="Get an offer when you pass a shop you haven't joined. At most one a day" right={<Switch value={walkPast} disabled={walkPastBusy} onValueChange={(v) => void toggleWalkPast(v)} trackColor={{ true: colors.primary }} />} />}
                <SettingsRow tile="amber" icon={(c) => <BellIcon color={c} size={18} />} title="Notification settings" detail="Shop news and reward alerts, managed in your phone settings" onPress={() => void Linking.openSettings()} last />
              </SettingsGroup>

              <SettingsGroup title="Support">
                <SettingsRow tile="green" icon={(c) => <HelpIcon color={c} size={18} />} title="Help & FAQ" onPress={() => openUrl(`${WEB}/help`)} />
                <SettingsRow tile="teal" icon={(c) => <MailIcon color={c} size={18} />} title="Contact us" detail="help@the-loyalty-loop.com" onPress={() => openUrl('mailto:help@the-loyalty-loop.com')} last />
              </SettingsGroup>

              <SettingsGroup title="Legal">
                <SettingsRow tile="slate" icon={(c) => <DocIcon color={c} size={18} />} title="Privacy notice" onPress={() => openUrl(`${WEB}/legal/privacy-notice.pdf`)} />
                <SettingsRow tile="slate" icon={(c) => <DocIcon color={c} size={18} />} title="Terms of service" onPress={() => openUrl(`${WEB}/legal/terms-of-service.pdf`)} last />
              </SettingsGroup>

              <SettingsGroup title="Account">
                <SettingsRow tile="orange" icon={(c) => <LogOutIcon color={c} size={18} />} title="Sign out" onPress={confirmSignOut} />
                <SettingsRow icon={(c) => <TrashIcon color={c} size={18} />} title="Delete account" detail="Permanently removes your login, linked cards, stamps and rewards" onPress={confirmDeleteAccount} danger last />
              </SettingsGroup>

              <Pressable
                onLongPress={() => {
                  const next = !simulatedOutage()
                  setSimulatedOutage(next)
                  showAlert(next ? 'Outage test on' : 'Outage test off', next ? 'The app now acts as if our servers are down, on this phone only. Long-press here again to turn it off.' : 'Back to normal.')
                }}
                delayLongPress={1200}
              >
                <Text style={styles.settingsFooter}>The Loyalty Loop v{version} · {updateLabel}{simulatedOutage() ? ' · outage test' : ''}</Text>
              </Pressable>
            </>
          )}

          {view === 'card' && (
            <View style={styles.cardScreen}>
              <View style={styles.cardQr}>
                <QRCode value={`loyaltyloop:customer:${userId}`} size={200} color="#000000" backgroundColor="#FFFFFF" />
              </View>
              <Text style={styles.cardName}>{firstName}</Text>
              <Text style={styles.manualCodeLabel}>Your code</Text>
              <Text selectable style={styles.manualCode}>{stampCode || 'Loading…'}</Text>
              <Text style={styles.small}>Show this when you pay at a participating shop to earn rewards. If the scanner can’t read it, the shop can type your code instead.</Text>
            </View>
          )}

          {view === 'externalCards' && <ExternalCards userId={userId} />}
          {view === 'name' && (
            <>
              <View style={styles.settingsCard}>
                <Text style={styles.settingsFieldLabel}>First name</Text>
                <TextInput value={name} onChangeText={setName} placeholder="Your first name" placeholderTextColor={schemeColor("#000000", 'fg')} style={styles.settingsInput} autoCapitalize="words" autoFocus returnKeyType="done" onSubmitEditing={() => void saveName()} />
                <Text style={styles.settingsFieldHelp}>Shops see this name when they record a purchase or you leave a review.</Text>
              </View>
              <View style={styles.settingsCard}>
                <SettingsRow tile="teal" icon={(c) => <MailIcon color={c} size={18} />} title="Email" detail={email} last />
              </View>
              <Button title={savingName ? 'Saving…' : 'Save'} onPress={() => void saveName()} disabled={savingName} />
            </>
          )}

          {view === 'cards' && (() => {
            const atLimit = cardLinking.cards.length >= cardLinking.limit
            const remaining = cardLinking.limit - cardLinking.cards.length
            return (
              <>
                <View style={styles.cardsExplainer}>
                  <Text style={styles.cardsExplainerTitle}>Earn without scanning</Text>
                  <Text style={styles.cardsExplainerLine}>• Pay with a linked card at shops marked ⚡</Text>
                  <Text style={styles.cardsExplainerLine}>• Your progress updates within seconds</Text>
                  <Text style={styles.cardsExplainerLine}>• We never see your full card number</Text>
                </View>
                <View style={styles.settingsCard}>
                  {cardLinking.cards.length === 0 ? (
                    <Text style={styles.settingsEmpty}>No cards linked yet.</Text>
                  ) : (
                    cardLinking.cards.map((linkedCard, index) => (
                      <SettingsRow
                        key={linkedCard.linkedCardId}
                        tile="green"
                        icon={(c) => <CardIcon color={c} size={18} />}
                        title={cardLabel(linkedCard)}
                        detail={`Linked ${new Date(linkedCard.linkedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                        right={
                          <Pressable onPress={() => confirmRemoveCard(linkedCard)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove ${cardLabel(linkedCard)}`}>
                            <Text style={styles.blockRowUnblock}>Remove</Text>
                          </Pressable>
                        }
                        last={index === cardLinking.cards.length - 1}
                      />
                    ))
                  )}
                </View>
                <Button
                  title={cardLinking.stage === 'preparing' ? 'Preparing…' : cardLinking.stage === 'verifying' ? 'Checking your card…' : 'Link a card'}
                  onPress={onLinkCard}
                  disabled={atLimit || cardLinking.stage !== 'idle'}
                />
                <Text style={styles.cardsHelp}>
                  {atLimit
                    ? `You’ve linked the maximum of ${cardLinking.limit} cards. Remove one to add another.`
                    : `You can link up to ${cardLinking.limit} cards. ${remaining} left.`}
                </Text>
                <Text style={styles.cardsHelp}>
                  Use the long number on the front of your physical card, not a virtual card number, so Apple Pay and Google Pay payments count too. Card details are collected securely by our partner Fidel API.
                </Text>
              </>
            )
          })()}

          {view === 'blocked' && (
            <View style={styles.settingsCard}>
              {blocks.length === 0 ? (
                <Text style={styles.settingsEmpty}>You haven’t blocked anyone. Blocking someone from a review hides everything they write from you.</Text>
              ) : (
                blocks.map((block, index) => (
                  <SettingsRow
                    key={block.blocked_id}
                    tile="rose"
                    icon={(c) => <BanIcon color={c} size={18} />}
                    title="Blocked reviewer"
                    detail={`Blocked on ${new Date(block.created_at).toLocaleDateString()}`}
                    right={<Pressable onPress={() => void unblock(block.blocked_id)} hitSlop={8}><Text style={styles.blockRowUnblock}>Unblock</Text></Pressable>}
                    last={index === blocks.length - 1}
                  />
                ))
              )}
            </View>
          )}
        </KeyboardAwareScrollView>
      </SafeAreaView>
      {/* Nested inside the settings sheet so it presents on top of it. */}
      <RequestedShopsSheet visible={visible && showRequests} onClose={() => setShowRequests(false)} onViewShop={id => { setShowRequests(false); onViewRequested(id) }} />
    </Sheet>
  )
}

// ---------------------------------------------------------------------
// Shop detail
// ---------------------------------------------------------------------

/** The stamp/points progress bar: width eases to the new percentage, and the
 * whole pill gets a quick scale pulse the moment it reaches 100% (a reward or
 * tier threshold crossed). The stamp count text next to it stays un-animated. */
function LoyaltyProgressBar({ pct, color }: { pct: number; color: string }) {
  const width = useSharedValue(pct)
  const scale = useSharedValue(1)
  const prevPct = useRef(pct)

  useEffect(() => {
    width.set(withTiming(pct, { duration: 400, easing: Easing.out(Easing.cubic) }))
    if (pct >= 100 && prevPct.current < 100) {
      scale.set(withSequence(withTiming(1.05, { duration: 120 }), withTiming(1, { duration: 160 })))
    }
    prevPct.current = pct
  }, [pct, width, scale])

  const containerStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }))
  const fillStyle = useAnimatedStyle(() => ({ width: `${width.get()}%` }))

  return (
    <Animated.View style={[styles.bar, containerStyle]}>
      <Animated.View style={[styles.barFill, { backgroundColor: color }, fillStyle]} />
    </Animated.View>
  )
}

// Last stamp/points value this session has observed per business, so
// ShopDetail can tell "the count just went up" apart from "this is the
// first time we've loaded this shop". Module-level (not a ref) because
// ShopDetail fully unmounts when the shopper backs out of a shop — a
// component-local ref would forget the baseline on the next visit. Resets
// on app restart, which is fine: no AsyncStorage persistence is needed here.
const lastObservedStampValues: Record<string, number> = {}

/** The reward lists home uses for progress (stamp/spend rewards, membership
 * levels, points rewards). Null when the main read fails, so callers keep what
 * they had rather than blanking every card. */
async function fetchHomeCatalog(): Promise<HomeTier[] | null> {
  const [catalogRows, levelRows, pointsRows] = await Promise.all([
    supabase.from('reward_catalog').select('business_id,title,stamp_threshold,spend_threshold_pence'),
    supabase.from('membership_tiers').select('business_id,name,spend_threshold_pence'),
    supabase.from('reward_catalog').select('business_id,title,points_cost').gt('points_cost', 0),
  ])
  if (catalogRows.error) return null
  const levels: HomeTier[] = levelRows.error ? [] : (levelRows.data || []).map((row: any) => ({
    business_id: row.business_id, title: row.name, stamp_threshold: 0, spend_threshold_pence: row.spend_threshold_pence, kind: 'tier',
  }))
  const points: HomeTier[] = pointsRows.error ? [] : (pointsRows.data || []).map((row: any) => ({
    business_id: row.business_id, title: row.title, stamp_threshold: 0, points_cost: row.points_cost,
  }))
  return [...((catalogRows.data || []) as HomeTier[]), ...levels, ...points]
}

function ShopDetail({
  business,
  userId,
  membership,
  stampCode,
  favourite,
  onBack,
  onToggleFavourite,
  refresh,
  cardLinking,
  onLinkCard,
  onJoined,
  programmeVersion = 0,
  seedCatalog,
  openAtCode = false,
}: {
  business: Business
  userId: string
  membership?: Membership
  stampCode: string | null
  favourite: boolean
  onBack: () => void
  onToggleFavourite: () => void
  refresh: () => Promise<void>
  cardLinking: CardLinking
  onLinkCard: () => void
  /** Puts a just-joined membership on screen without waiting for a full reload. */
  onJoined: (membership: Membership) => void
  /** Goes up when any shop's programme changes, so this page reloads its rewards. */
  programmeVersion?: number
  /** Home's copy of this shop's rewards (loaded at launch, saved on the phone), used while
   * the page loads its own. Null when home has never loaded any. */
  seedCatalog: Pick<RewardCatalogItem, 'title' | 'stamp_threshold' | 'spend_threshold_pence' | 'points_cost'>[] | null
  /** Opened from "Show my card": scroll straight to the code. */
  openAtCode?: boolean
}) {
  const { isDark } = useTheme()
  const [busy, setBusy] = useState(false)
  const [addingToWallet, setAddingToWallet] = useState(false)
  const [catalog, setCatalog] = useState<RewardCatalogItem[]>([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [reviews, setReviews] = useState<ShopReview[]>([])
  const [gallery, setGallery] = useState<BusinessPhoto[]>([])
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewBody, setReviewBody] = useState('')
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [savingReview, setSavingReview] = useState(false)
  const [hiddenReviewIds, setHiddenReviewIds] = useState<Set<string>>(new Set())
  // Spend shops (ARCH_PLAN.md §4.11) count pence towards £ reward tiers.
  // Negative progress (after a refund or a corrected entry) displays as £0.00.
  const spendShop = business.reward_model === 'spend_threshold'
  const programmeId = programmeIdFor(business)
  // Custom (AI-designed) programmes keep a points wallet like Points shops.
  const pointsLike = programmeId === 'points' || programmeId === 'custom'
  const pointUnits = unitNames(business)
  const value = spendShop
    ? Math.max(0, membership?.reward_progress_pence ?? 0)
    : pointsLike || business.loyalty_type === 'points' ? membership?.points_balance || 0 : membership?.stamp_count || 0
  const [tiers, setTiers] = useState<TierRow[]>([])
  const [rollingSpend, setRollingSpend] = useState<number | null>(null)
  const scrollRef = useRef<ScrollView>(null)
  const cardY = useRef(0)
  const passRef = useRef<View>(null)
  const codeRef = useRef<View>(null)
  const insets = useSafeAreaInsets()
  // "Show my card" opens the page with the code in full view (no animation: the page simply
  // opens there), once per shop opened, keeping as much of the card above it as fits.
  const scrolledToCode = useRef<string | null>(null)
  const showCode = () => {
    if (!openAtCode || scrolledToCode.current === business.id || !codeRef.current || !passRef.current) return
    scrolledToCode.current = business.id
    codeRef.current.measureLayout(passRef.current, (_x, y, _w, h) => {
      const visible = Dimensions.get('window').height - insets.top - insets.bottom
      const target = cardY.current + y + h + 40 - visible
      if (target > 0) scrollRef.current?.scrollTo({ y: target, animated: false })
    }, () => undefined)
  }
  // How much just landed on the card, for the receipt (null when nothing new).
  const [landed, setLanded] = useState<number | null>(null)
  // After the receipt closes, the new stamps land on the card one by one.
  const [thump, setThump] = useState<{ count: number; key: number } | null>(null)

  // Celebrate a stamp/points increase — arriving live from the realtime
  // membership feed while this page is open, or picked up on mount/refresh
  // if it landed while they were elsewhere. Skipped on the very
  // first load of a shop (no prior value yet, which would false-positive
  // on every fresh visit).
  useEffect(() => {
    const previous = lastObservedStampValues[business.id]
    if (previous !== undefined && value > previous) setLanded(value - previous)
    lastObservedStampValues[business.id] = value
  }, [business.id, value])

  // While this page's own copy loads, the card uses home's copy of the same rewards, so it
  // never shows a stand-in target. `holding`: neither copy exists yet, so the count waits.
  const targets = catalogLoading ? [...(seedCatalog ?? [])].sort((a, b) => a.stamp_threshold - b.stamp_threshold) : catalog
  const holding = catalogLoading && seedCatalog === null
  // Rewards unlock at the catalogue tiers, so progress is shown towards the next
  // one: the lowest tier above the customer's progress, or the top tier (where a
  // new round starts). Mirrors spend_next_tier in the database.
  const spendTiers = targets
    .filter((reward) => (reward.spend_threshold_pence ?? 0) > 0)
    .sort((a, b) => (a.spend_threshold_pence as number) - (b.spend_threshold_pence as number))
  const nextTier = spendShop
    ? spendTiers.find((reward) => (reward.spend_threshold_pence as number) > value) ?? spendTiers[spendTiers.length - 1]
    : targets.find((reward) => reward.stamp_threshold > value) ?? targets[targets.length - 1]
  const threshold = spendShop
    ? nextTier?.spend_threshold_pence || business.reward_threshold_pence || 2000
    : nextTier?.stamp_threshold || business.loyalty_config?.stamps_required || 10
  const label = business.loyalty_type === 'points' ? 'points' : business.loyalty_type === 'tiered' ? 'visits' : 'stamps'
  const hasMapCoordinates = typeof business.lat === 'number' && typeof business.lng === 'number'
  const mapDestination = hasMapCoordinates ? `${business.lat},${business.lng}` : business.address || ''
  const externalUrl = (value: string) => /^https?:\/\//i.test(value) ? value : `https://${value}`
  const socialLinks = [
    business.website && { label: 'Website', value: business.website, url: externalUrl(business.website) },
    business.instagram && { label: 'Instagram', value: business.instagram, url: `https://instagram.com/${business.instagram.replace(/^@|https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/$/, '')}` },
    business.tiktok && { label: 'TikTok', value: business.tiktok, url: `https://www.tiktok.com/@${business.tiktok.replace(/^@|https?:\/\/(www\.)?tiktok\.com\/@?/i, '').replace(/\/$/, '')}` },
    business.youtube && { label: 'YouTube', value: business.youtube, url: externalUrl(business.youtube) },
  ].filter(Boolean) as { label: string; value: string; url: string }[]

  // memberships.promos_opted_out: when true the shop's announcements are neither
  // pushed nor added to this customer's inbox (deliver_shop_announcement trigger).
  async function setShopNotifications(enabled: boolean) {
    const { error } = await supabase.from('memberships').update({ promos_opted_out: !enabled }).eq('user_id', userId).eq('business_id', business.id)
    if (error) return showAlert('Could not update notifications', error.message)
    await refresh()
  }

  const catalogFor = useRef<string | null>(null)
  useEffect(() => {
    let active = true
    // Only show loading when opening a shop; a live programme change swaps the rewards in place.
    if (catalogFor.current !== business.id) setCatalogLoading(true)
    catalogFor.current = business.id
    supabase
      .from('reward_catalog')
      .select('id,title,description,stamp_threshold,spend_threshold_pence,points_cost')
      .eq('business_id', business.id)
      .order(spendShop ? 'spend_threshold_pence' : 'stamp_threshold')
      .order(spendShop ? 'stamp_threshold' : 'spend_threshold_pence')
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
  }, [business.id, spendShop, programmeVersion])

  // Membership tiers: the ladder is public. The shopper's own spend over the last
  // 12 months is read from their own transactions (they can see those); if that
  // fails the page shows the next level's threshold instead of a distance.
  useEffect(() => {
    if (programmeId !== 'tiers') { setTiers([]); return }
    let active = true
    supabase
      .from('membership_tiers')
      .select('id,name,spend_threshold_pence,perks,colour,sort_order')
      .eq('business_id', business.id)
      .order('spend_threshold_pence')
      .then(({ data, error }) => {
        if (active) setTiers(error ? [] : ((data || []) as TierRow[]))
      })
    return () => { active = false }
  }, [business.id, programmeId, programmeVersion])

  useEffect(() => {
    if (programmeId !== 'tiers' || !membership) { setRollingSpend(null); return }
    let active = true
    const since = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()
    supabase
      .from('transactions')
      .select('value')
      .eq('user_id', userId)
      .eq('business_id', business.id)
      .eq('type', 'spend')
      .is('voided_at', null)
      .gt('created_at', since)
      .then(({ data, error }) => {
        if (!active) return
        setRollingSpend(error || !data ? null : data.reduce((sum, row) => sum + Number(row.value || 0), 0))
      })
    return () => { active = false }
  }, [business.id, userId, programmeId, membership?.current_tier_id, !!membership])

  useEffect(() => {
    let active = true
    supabase
      .from('business_photos')
      .select('id,url,sort_order')
      .eq('business_id', business.id)
      .order('sort_order')
      .then(({ data, error }) => {
        if (active && !error) setGallery((data || []) as BusinessPhoto[])
      })
    return () => { active = false }
  }, [business.id])

  // Background checks for the shop's reply after a review is saved. The array
  // itself also marks this visit to the shop: leaving or switching shop clears
  // its timers and swaps in a new array, so any load, save or check started
  // during the old visit sees it is stale and changes nothing.
  const replyChecks = useRef<ReturnType<typeof setTimeout>[]>([])

  // Refreshes the list only. It never touches the review editor, so a check
  // that lands while the shopper is typing can't overwrite their edit.
  // Returns null when the shopper has since left this shop.
  const loadReviews = async () => {
    const visit = replyChecks.current
    setReviewsLoading(true)
    try {
      // Reviews by users this shopper has blocked never come back — the
      // `reviews_select_visible` RLS policy filters them out server-side.
      const { data, error } = await supabase
        .from('reviews')
        .select('id,user_id,rating,body,created_at,reply:review_replies(body,created_at)')
        .eq('business_id', business.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      if (visit !== replyChecks.current) return null
      const items = ((data || []) as ShopReview[]).filter((review) => !hiddenReviewIds.has(review.id))
      setReviews(items)
      return items
    } catch {
      if (visit !== replyChecks.current) return null
      setReviews([])
      return []
    } finally {
      if (visit === replyChecks.current) setReviewsLoading(false)
    }
  }

  useEffect(() => {
    // Opening a shop fills the editor with the shopper's own review, once.
    void loadReviews().then((items) => {
      if (!items) return
      const mine = items.find((review) => review.user_id === userId)
      if (mine) {
        setReviewRating(mine.rating)
        setReviewBody(mine.body || '')
      }
    })
    return () => {
      replyChecks.current.forEach(clearTimeout)
      replyChecks.current = []
    }
  }, [business.id, userId])

  const myReview = reviews.find((review) => review.user_id === userId)
  // Worked out from the reviews loaded on this page, so it updates as soon as someone posts.
  const pageRating = ratingLabel(ratingStats(reviews.map((review) => ({ business_id: business.id, rating: review.rating }))).get(business.id) ?? {})

  async function saveReview() {
    const cleaned = reviewBody.trim()
    if (cleaned && containsBlockedLanguage(cleaned)) {
      showAlert('Please rewrite your review', 'It looks like your review contains language that breaks our community rules. Reviews with hate speech, slurs or harassment are not allowed.')
      return
    }
    const visit = replyChecks.current
    setSavingReview(true)
    try {
      const { error } = await supabase
        .from('reviews')
        .upsert(
          { business_id: business.id, user_id: userId, rating: reviewRating, body: cleaned || null },
          { onConflict: 'user_id,business_id' },
        )
      if (error) throw error
      // The review is saved either way; if the shopper has left this shop
      // there is nothing more to show them here.
      if (visit !== replyChecks.current) return
      await loadReviews()
      if (visit !== replyChecks.current) return
      // The shop's reply (often written by AI within seconds) arrives just
      // after the review is saved, so look again shortly.
      for (const delay of [4000, 12000]) {
        visit.push(setTimeout(() => { if (visit === replyChecks.current) void loadReviews() }, delay))
      }
      showAlert('Review saved', 'Thank you for sharing your experience.')
    } catch (error) {
      if (visit === replyChecks.current) {
        showAlert('Could not save review', error instanceof Error ? error.message : 'Please try again.')
      }
    } finally {
      // Always reset, or the next shop's Save button would stay disabled.
      setSavingReview(false)
    }
  }

  function reportReview(review: ShopReview) {
    const submit = async (reason: 'spam' | 'offensive' | 'harassment' | 'off_topic' | 'other') => {
      // Hide it immediately for this shopper, then queue it for a moderator.
      setHiddenReviewIds((prev) => new Set(prev).add(review.id))
      setReviews((prev) => prev.filter((item) => item.id !== review.id))
      try {
        const { error } = await supabase
          .from('review_reports')
          .upsert({ review_id: review.id, reporter_id: userId, reason }, { onConflict: 'review_id,reporter_id' })
        if (error) throw error
        showAlert('Thanks for letting us know', 'We’ve hidden this review for you and our team will look at it within 24 hours.')
      } catch (e) {
        showAlert('Could not send the report', e instanceof Error ? e.message : 'Please try again.')
      }
    }
    showAlert('Report this review', 'Why are you reporting it?', [
      { text: 'Spam or fake', onPress: () => void submit('spam') },
      { text: 'Offensive or hateful', onPress: () => void submit('offensive') },
      { text: 'Harassment or bullying', onPress: () => void submit('harassment') },
      { text: 'Not about this shop', onPress: () => void submit('off_topic') },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  function blockAuthor(review: ShopReview) {
    showAlert(
      'Block this person?',
      'You will no longer see any reviews written by this person, on any shop. You can undo this from your profile.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('user_blocks')
                .upsert({ blocker_id: userId, blocked_id: review.user_id }, { onConflict: 'blocker_id,blocked_id' })
              if (error) throw error
              setReviews((prev) => prev.filter((item) => item.user_id !== review.user_id))
              showAlert('Blocked', 'You will not see reviews from this person any more.')
            } catch (e) {
              showAlert('Could not block', e instanceof Error ? e.message : 'Please try again.')
            }
          },
        },
      ],
    )
  }

  function deleteReview() {
    if (!myReview) return
    showAlert('Delete your review?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          setSavingReview(true)
          try {
            const { error } = await supabase.from('reviews').delete().eq('id', myReview.id)
            if (error) throw error
            setReviewRating(5)
            setReviewBody('')
            await loadReviews()
          } catch (error) {
            showAlert('Could not delete review', error instanceof Error ? error.message : 'Please try again.')
          } finally {
            setSavingReview(false)
          }
        },
      },
    ])
  }

  const pointsView = pointsStanding(
    business,
    value,
    (catalogLoading ? (seedCatalog ?? []).map((r, i) => ({ ...r, id: `seed-${i}` })) : catalog)
      .filter((r) => (r.points_cost ?? 0) > 0).map((r) => ({ id: r.id, title: r.title, points_cost: r.points_cost as number })),
    pointUnits,
  )

  async function join() {
    setBusy(true)
    try {
      const { error } = await supabase.from('memberships').upsert({ user_id: userId, business_id: business.id }, { onConflict: 'user_id,business_id' })
      // Already a member (e.g. stale UI after joining elsewhere) — not a real failure.
      if (error && error.code !== '23505') throw error
      // Show the card straight away from the saved row, rather than waiting on
      // (and depending on) the full home reload, which runs in the background.
      const { data: row, error: readError } = await supabase.from('memberships').select('*').eq('user_id', userId).eq('business_id', business.id).maybeSingle()
      if (readError) throw readError
      if (row) onJoined(row as Membership)
      void refresh()
    } catch (e) {
      showAlert('Could not join', e instanceof Error ? e.message : 'Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function addToWallet() {
    setAddingToWallet(true)
    try {
      if (Platform.OS === 'ios') {
        // Apple Wallet passes are a signed .pkpass file we build ourselves
        // (see supabase/functions/create-apple-wallet-pass). Presented via a
        // native PassKit module (modules/expo-wallet-pass) so iOS shows the
        // real full-screen "Add to Apple Wallet" UI, not a share sheet.
        const { data: sessionData } = await supabase.auth.getSession()
        const accessToken = sessionData.session?.access_token
        if (!accessToken) throw new Error('Please sign in again.')
        const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-apple-wallet-pass`, {
          method: 'POST',
          headers: {
            apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ business_id: business.id }),
        })
        if (!res.ok) {
          const message = await res.json().catch(() => null)
          throw new Error((message as { error?: string } | null)?.error || 'Could not create the pass')
        }
        const bytes = new Uint8Array(await res.arrayBuffer())
        let binary = ''
        const chunkSize = 0x8000
        for (let i = 0; i < bytes.length; i += chunkSize) {
          binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
        }
        await addPassFromBase64(btoa(binary))
      } else {
        const { data, error } = await supabase.functions.invoke<{ saveUrl?: string; error?: string }>('create-wallet-pass', {
          body: { business_id: business.id },
        })
        if (error) throw error
        if (!data?.saveUrl) throw new Error(data?.error || 'Could not create the pass')
        await Linking.openURL(data.saveUrl)
      }
    } catch (e) {
      showAlert(Platform.OS === 'ios' ? 'Could not add to Apple Wallet' : 'Could not add to Google Wallet', e instanceof Error ? e.message : 'Please try again.')
    } finally {
      setAddingToWallet(false)
    }
  }

  const skin = useMemo(() => shopSkin(business), [business.card_design, business.category, business.brand_color])
  const passStamps = !spendShop && programmeId !== 'tiers' && programmeId !== 'points' && !['points', 'tiered'].includes(business.loyalty_type || '') && threshold > 0 && threshold <= 12
  const passProgress = programmeId === 'tiers' ? (rollingSpend != null && tiers.length ? tierStanding(tiers, rollingSpend).fraction : 0) : pointsLike ? (pointsView.next ? pointsView.fraction : 1) : threshold > 0 ? value / threshold : 0
  const reward = nextTier?.title ?? 'your next reward'
  const passLabel = !membership
    ? `Join to start collecting for ${reward}`
    : programmeId === 'tiers' ? membership.current_tier || 'Getting started'
    : pointsLike ? (pointsView.next ? pointsView.label : `${value} ${value === 1 ? pointUnits.one : pointUnits.many}`)
    : spendShop ? `${pounds(value, business.country_code)} of ${pounds(threshold, business.country_code)} · ${reward}`
    : value >= threshold ? `${reward} is ready` : `${threshold - value} more for ${reward}`
  const money = (pence: number) => pounds(pence, business.country_code)
  const unitOne = label.replace(/s$/, '')
  const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
  const receipt: ReceiptData | null = landed == null ? null
    : spendShop ? {
        title: 'Purchase added',
        headline: `+${money(landed)}`,
        shopName: business.name,
        lines: [
          { label: 'Purchase', value: money(landed) },
          { label: 'Towards reward', value: `${money(Math.min(value, threshold))} / ${money(threshold)}` },
        ],
        note: value >= threshold ? `${reward} is ready` : `${money(threshold - value)} more for ${reward}`,
      }
    : programmeId === 'points' || business.loyalty_type === 'points' ? {
        title: 'Points added',
        headline: `+${landed}`,
        shopName: business.name,
        lines: [
          { label: 'Points earned', value: `+${landed}` },
          { label: 'Balance', value: `${value} pts` },
        ],
        note: passLabel,
      }
    : {
        title: `${cap(landed === 1 ? unitOne : label)} added`,
        headline: `+${landed}`,
        shopName: business.name,
        lines: [
          { label: `${cap(landed === 1 ? unitOne : label)} today`, value: `+${landed}` },
          threshold > 0
            ? { label: 'Your card', value: `${Math.min(value, threshold)} / ${threshold}` }
            : { label: `Total ${label}`, value: String(value) },
        ],
        note: passLabel,
      }
  // The whole page wears the shop's design; the QR tile stays black on white so it scans.
  const ss = useMemo(() => {
    const skinned = skinStyles(styles, skin, { keep: ['qrText', 'pressed', 'disabled', 'nativeMap', 'mapEmbed', 'shortCard', 'shortImage', 'shortOverlay', 'shortShopName', 'shortIndex', 'favouriteButton'], clear: ['screen'] })
    return { ...skinned, qrWrap: [styles.qrWrap, { backgroundColor: schemeColor('#FFFFFF', 'bg'), alignSelf: 'center' as const, padding: 16, borderRadius: 18 }] }
  }, [skin])
  return (
    <ShopSkinProvider value={skin}>
    <SafeAreaView style={[styles.safe, { backgroundColor: skin.bg }]}>
      <StatusBar barStyle={statusBarStyle(isDark, skin.dark)} />
      <ShopBackdrop skin={skin} />
      <KeyboardAwareScrollView ref={scrollRef} contentContainerStyle={ss.screen}>
        <View ref={passRef} style={{ marginHorizontal: -20, marginTop: -20 }} onLayout={(e) => { cardY.current = e.nativeEvent.layout.y }}>
          <ShopPass
            skin={skin}
            shop={business}
            eyebrow={[business.category || 'Local business', openStatus(business.opening_hours)?.label].filter(Boolean).join(' · ')}
            stamps={membership && passStamps && !holding ? { filled: Math.min(value, threshold), total: threshold } : null}
            wrapStamp={(i, stamp) => {
              const filled = Math.min(value, threshold)
              const first = filled - (thump?.count ?? 0)
              if (!thump || i < first || i >= filled) return stamp
              return <StampThump key={thump.key} delay={(i - first) * 170} ringColor={skin.accent} radius={14}>{stamp}</StampThump>
            }}
            count={!membership || programmeId === 'tiers' || holding ? null
              : pointsLike ? { value: String(value), of: pointsLike && programmeId === 'custom' ? ` ${pointUnits.many}` : ' pts' }
              : spendShop ? (threshold > 0 ? { value: pounds(Math.min(value, threshold), business.country_code).replace(/\.00$/, ''), of: `/${pounds(threshold, business.country_code).replace(/\.00$/, '')}` } : null)
              : passStamps ? { value: String(Math.min(value, threshold)), of: `/${threshold}` } : null}
            progress={membership && !passStamps && !holding ? passProgress : null}
            progressLabel={holding ? (membership ? 'Loading your card…' : 'Join to start collecting') : passLabel}
            code={membership ? <View ref={codeRef} onLayout={showCode} style={{ alignItems: 'center' }}><QRCode value={`loyaltyloop:customer:${userId}`} size={190} /><Tip id="member-code" text="Show this code when you pay to collect" /></View> : null}
            action={membership ? null : (
              <Pressable accessibilityRole="button" onPress={join} disabled={busy} style={({ pressed }) => [{ marginTop: 26, backgroundColor: '#FFFFFF', borderRadius: 999, paddingVertical: 16, paddingHorizontal: 48, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 8 }, (busy || pressed) && { opacity: 0.8 }]}>
                <Text style={{ color: skin.dark ? skin.bg : skin.ink, fontWeight: '800', fontSize: 17 }}>{busy ? 'Joining…' : 'Join card'}</Text>
              </Pressable>
            )}
            fields={[
              ...(membership ? [{ label: 'Your code', value: stampCode || '…' }, { label: 'Next reward', value: nextTier?.title ?? (catalogLoading ? '…' : 'Coming soon') }] : []),
              ...(pageRating ? [{ label: 'Rating', value: `${pageRating} (${reviews.length})` }] : []),
              ...(business.features?.length ? [{ label: 'Good to know', value: business.features.map(id => featureBadge(id, business.halal_certifier)).slice(0, 2).join(', ') }] : []),
            ]}
            topBar={
              <>
                <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} hitSlop={12} style={{ padding: 8 }}>
                  <ChevronLeftIcon size={24} color={skin.ink} />
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={favourite ? 'Remove from favourites' : 'Add to favourites'} onPress={onToggleFavourite} hitSlop={12} style={{ padding: 8 }}>
                  <HeartIcon color={skin.ink} filled={favourite} size={22} />
                </Pressable>
              </>
            }
          />
        </View>
        {membership && spendShop && membership.redemption_blocked_reason ? (
          <Text style={[ss.spendHint, { marginTop: 16 }]}>Rewards here are paused for now: a refund or a corrected purchase reduced your spend. They unlock again as you spend.</Text>
        ) : null}
        {membership ? (
          <View style={{ gap: 12, marginTop: 16 }}>
            <PassRow skin={skin} icon={<WalletIcon size={20} color={skin.ink} />} label={addingToWallet ? 'Preparing…' : Platform.OS === 'ios' ? 'Add to Apple Wallet' : 'Add to Google Wallet'} onPress={addingToWallet ? undefined : addToWallet} />
            <PassRow skin={skin} icon={<BellIcon color={skin.ink} size={20} />} label="News and offers" right={<Switch value={!membership.promos_opted_out} onValueChange={(v) => void setShopNotifications(v)} trackColor={{ true: skin.accent }} />} />
          </View>
        ) : null}
        {business.description ? <Text style={[ss.description, { marginTop: 20 }]}>{business.description}</Text> : null}

        {cardLinking.enabled && cardLinking.linkedShopIds.has(business.id) ? (
          cardLinking.cards.length === 0 ? (
            <View style={ss.autoEarnCard}>
              <View style={ss.autoEarnRow}>
                <BoltIcon color={schemeColor("#c77c12", 'fg')} size={16} />
                <Text style={ss.autoEarnTitle}>Earn automatically here</Text>
              </View>
              <Text style={ss.autoEarnCopy}>Link the card you pay with. When you use it here, your progress updates by itself.</Text>
              <Button
                secondary
                title={cardLinking.stage === 'preparing' ? 'Preparing…' : cardLinking.stage === 'verifying' ? 'Checking your card…' : 'Link a card'}
                onPress={onLinkCard}
                disabled={cardLinking.stage !== 'idle'}
              />
            </View>
          ) : (
            <View style={ss.autoEarnChip}>
              <BoltIcon color={schemeColor("#c77c12", 'fg')} size={14} />
              <Text style={ss.autoEarnChipText}>Pay with a linked card to earn automatically</Text>
            </View>
          )
        ) : null}

        <HowItWorks
          business={business}
          membership={membership}
          catalog={catalog}
          tiers={tiers}
          rollingSpendPence={rollingSpend}
          money={(pence) => pounds(pence, business.country_code)}
          refresh={refresh}
        />

        {mapDestination ? <View style={ss.visitSection}>
          <Text style={ss.sectionTitle}>Find your way there</Text>
          {hasMapCoordinates ? (
            <View style={ss.mapEmbed}>
              <MapView
                customMapStyle={QUIET_MAP_STYLE}
                showsPointsOfInterest={false}
                provider={PROVIDER_GOOGLE}
                style={ss.nativeMap}
                initialRegion={{
                  latitude: business.lat!,
                  longitude: business.lng!,
                  latitudeDelta: 0.012,
                  longitudeDelta: 0.012,
                }}
                scrollEnabled
                rotateEnabled={false}
              >
                <ShopMarker business={business} description={business.address || undefined} />
              </MapView>
            </View>
          ) : null}
          <Text style={ss.mapAddress}>{business.address || 'Open Google Maps for directions'}</Text>
          <Pressable onPress={() => void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapDestination)}`)} style={({ pressed }) => [ss.directionsButton, pressed && ss.pressed]}>
            <Text style={ss.directionsButtonText}>Get directions in Google Maps</Text>
          </Pressable>
        </View> : null}

        {(business.phone || socialLinks.length > 0) ? <View style={ss.visitSection}>
          <Text style={ss.sectionTitle}>Stay connected</Text>
          <View style={ss.contactList}>
            {business.phone && <Pressable onPress={() => void Linking.openURL(`tel:${business.phone}`)} style={ss.contactRow}><Text style={ss.contactLabel}>Call the shop</Text><Text style={ss.contactValue}>{business.phone}</Text></Pressable>}
            {socialLinks.map((link) => <Pressable key={link.label} onPress={() => void Linking.openURL(link.url)} style={ss.contactRow}><Text style={ss.contactLabel}>{link.label}</Text><Text numberOfLines={1} style={ss.contactValue}>{link.value}</Text></Pressable>)}
          </View>
        </View> : null}

        {business.opening_hours && Object.keys(business.opening_hours).length > 0 ? <View style={ss.visitSection}>
          <Text style={ss.sectionTitle}>Opening hours</Text>
          <OpeningHoursList hours={business.opening_hours} />
        </View> : null}

        {membership && gallery.length > 0 && <View style={ss.gallerySection}>
          <View style={ss.galleryHeading}><View><Text style={ss.sectionTitle}>From the shop</Text><Text style={ss.gallerySubheading}>Scroll through their latest moments</Text></View><Text style={ss.galleryCount}>{gallery.length} photos</Text></View>
          <View style={ss.shortsFeed}>
            {gallery.map((photo, index) => <View key={photo.id} style={ss.shortCard}>
              <Image source={{ uri: photo.url }} style={ss.shortImage} resizeMode="cover" />
              <View style={ss.shortOverlay}><Text style={ss.shortIndex}>{String(index + 1).padStart(2, '0')} / {String(gallery.length).padStart(2, '0')}</Text><Text style={ss.shortShopName}>{business.name}</Text></View>
            </View>)}
          </View>
        </View>}

        <View style={ss.reviewsSection}>
          <Text style={ss.sectionTitle}>Reviews</Text>
          {!membership ? (
            <Text style={ss.reviewHint}>Join this loyalty card to share your experience.</Text>
          ) : (
            <View style={ss.reviewComposer}>
              <Text style={ss.reviewComposerTitle}>{myReview ? 'Update your review' : 'Share your experience'}</Text>
              <View style={ss.starRow}>
                {[1, 2, 3, 4, 5].map((rating) => (
                  <Pressable key={rating} accessibilityRole="button" accessibilityLabel={`${rating} ${rating === 1 ? 'star' : 'stars'}`} accessibilityState={{ selected: rating === reviewRating }} onPress={() => setReviewRating(rating)} hitSlop={8} style={ss.starButton}>
                    <Text style={[ss.star, rating <= reviewRating && ss.starSelected]}>★</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                value={reviewBody}
                onChangeText={setReviewBody}
                placeholder="What did you enjoy?"
                // The box stays white on every shop design and in dark mode, so its text is fixed dark.
                placeholderTextColor="#6F6B64"
                multiline
                maxLength={2000}
                style={[ss.reviewInput, { color: '#1A2138' }]}
              />
              <Button title={savingReview ? 'Saving…' : myReview ? 'Update review' : 'Post review'} onPress={saveReview} disabled={savingReview} />
              {myReview && <Pressable onPress={deleteReview} disabled={savingReview}><Text style={ss.deleteReview}>Delete review</Text></Pressable>}
            </View>
          )}

          {reviewsLoading ? (
            <WhirlSpinner size={28} style={{ marginTop: 20 }} />
          ) : reviews.length === 0 ? (
            <Text style={ss.reviewHint}>Be the first to review this shop.</Text>
          ) : (
            <View style={ss.reviewList}>
              {reviews.map((review) => (
                <View key={review.id} style={ss.reviewItem}>
                  <View style={ss.reviewHeaderRow}>
                    <Text style={ss.reviewAuthor}>{review.user_id === userId ? 'You' : 'Neighbour'}</Text>
                    <Text style={ss.reviewDate}>{new Date(review.created_at).toLocaleDateString()}</Text>
                  </View>
                  <Text style={ss.reviewStars}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</Text>
                  {!!review.body && <Text style={ss.reviewBody}>{review.body}</Text>}
                  {reviewReply(review) && (
                    <View style={[ss.reviewReply, { borderLeftColor: business.brand_color || colors.primary }]}>
                      <Text style={ss.reviewReplyTitle}>Reply from {business.name}</Text>
                      <Text style={ss.reviewBody}>{reviewReply(review)?.body}</Text>
                    </View>
                  )}
                  {review.user_id !== userId && (
                    <View style={ss.reviewModRow}>
                      <Pressable accessibilityRole="button" onPress={() => reportReview(review)} style={ss.reviewModButton}>
                        <Text style={ss.reviewModLink}>Report</Text>
                      </Pressable>
                      <Text style={ss.reviewModDot}>·</Text>
                      <Pressable accessibilityRole="button" onPress={() => blockAuthor(review)} style={ss.reviewModButton}>
                        <Text style={ss.reviewModLink}>Block this person</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      </KeyboardAwareScrollView>
      <ReceiptPrinter
        receipt={receipt}
        onFinished={() => {
          if (landed && passStamps) setThump({ count: landed, key: Date.now() })
          if (landed && value >= threshold) haptic.celebrate()
          setLanded(null)
        }}
      />
    </SafeAreaView>
    </ShopSkinProvider>
  )
}

// ---------------------------------------------------------------------
// Home tab
// ---------------------------------------------------------------------

function TrendingCard({ business, onPress }: { business: Business; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.trendingCard, pressed && styles.pressed]}>
      <View style={[styles.trendingCover, { backgroundColor: business.brand_color || colors.primary }]}>
        {business.cover_url && <Image source={{ uri: business.cover_url }} style={StyleSheet.absoluteFill} />}
      </View>
      <View style={styles.trendingContent}>
        <Text style={styles.trendingName} numberOfLines={1}>{business.name}</Text>
        <Text style={styles.muted} numberOfLines={1}>{[ratingLabel(business), business.category || 'Local business'].filter(Boolean).join(' · ')}</Text>
      </View>
    </Pressable>
  )
}

/** Dietary and access filters (Halal, Vegan options…); a shop must have every selected one. */
function FeatureFilter({ selected, onChange }: { selected: string[]; onChange: (next: string[]) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={featureStyles.filterRow}>
      {SHOP_FEATURES.map(feature => {
        const active = selected.includes(feature.id)
        return (
          <Pressable
            key={feature.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: active }}
            onPress={() => onChange(active ? selected.filter(id => id !== feature.id) : [...selected, feature.id])}
            style={({ pressed }) => [featureStyles.chip, active && featureStyles.chipActive, pressed && { opacity: 0.8 }]}
          >
            <Text style={[featureStyles.chipText, active && featureStyles.chipTextActive]}>{feature.label}</Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

const featureStyles = themed(() => StyleSheet.create({
  filterRow: { gap: 8, paddingVertical: 8, paddingRight: 8 },
  chip: { borderRadius: 999, borderWidth: 1.5, borderColor: colors.primary, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.card },
  chipActive: { backgroundColor: colors.primary },
  chipText: { color: schemeColor('#000000', 'fg'), fontWeight: '700', fontSize: 13 },
  chipTextActive: { color: schemeColor('#fff', 'fg') },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  badge: { borderRadius: 999, backgroundColor: schemeColor('#EEF3E6', 'bg'), paddingHorizontal: 12, paddingVertical: 4 },
  badgeText: { color: schemeColor('#000000', 'fg'), fontSize: 12, fontWeight: '700' },
}))

function HomeTab({ userId, businesses, memberships, catalog, announcements, loading, failed, onRetry, onSelect, onShowCard, onAsk, firstName, onOpenProfile, onSeeNews }: {
  userId: string; firstName?: string; onOpenProfile: () => void; onSeeNews: () => void;
  businesses: Business[]; memberships: Membership[]; catalog: HomeTier[];
  announcements: Announcement[]; loading: boolean; failed: boolean; onRetry: () => void; onSelect: (business: Business) => void; onShowCard: (business: Business) => void; onAsk: (query: string) => void;
}) {
  const [searching, setSearching] = useState(false)
  const [category, setCategory] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [features, setFeatures] = useState<string[]>([])
  const quickCards = useQuickCards(userId)
  const searchTerm = useDebouncedValue(query)
  // Typo-tolerant and ranked best-match-first; with no search text the list keeps its own order.
  const filtered = fuzzyFilter(businesses.filter(b => (!category || (b.category || 'Other') === category) && hasAllFeatures(b.features, features)), searchTerm, b => [b.name, b.category, b.address])
  const trending = trendingShops(businesses, filtered, { fallback: 4, limit: 4 })
  const { coords: userLocation, status: locationStatus, locate } = useUserLocation()
  const [askWhirl, setAskWhirl] = useState(false)
  // Android back closes search (AppHome's handler passes through on the Home tab).
  useEffect(() => {
    if (!searching) return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { setSearching(false); setQuery(''); setCategory(null); setFeatures([]); return true })
    return () => sub.remove()
  }, [searching])
  if (!searching) {
    if (loading && businesses.length === 0) return <SkeletonScreen cards={3} cardHeight={150} label="Finding your local favourites" />
    return <><HomeFeed firstName={firstName} shops={businesses} memberships={memberships} catalog={catalog} news={announcements}
      location={userLocation} locationStatus={locationStatus} onUseLocation={() => { void locate() }}
      onSelect={onSelect} onShowCard={onShowCard} failed={failed} onRetry={onRetry} onSearch={() => setSearching(true)} onSeeNews={onSeeNews} onAsk={() => onAsk('')} onOpenProfile={onOpenProfile}
      onAskWhirl={() => setAskWhirl(true)}
      quickIds={quickCards.ids} onQuickChange={quickCards.save} />
      <AskWhirlSheet visible={askWhirl} onClose={() => setAskWhirl(false)} mode="shopper"
        near={coarseNear(userLocation?.lat, userLocation?.lng)}
        resolveShop={id => { const b = businesses.find(x => x.id === id); return b ? { name: b.name } : null }}
        onOpenShop={id => { const b = businesses.find(x => x.id === id); if (b) { setAskWhirl(false); onSelect(b) } }} />
    </>
  }
  const closeSearch = () => { setSearching(false); setQuery(''); setCategory(null); setFeatures([]) }
  return <>
    <View style={homeStyles.searchTop}>
      <Text accessibilityRole="header" style={homeStyles.searchTitle}>Find a shop</Text>
      <Pressable accessibilityRole="button" onPress={closeSearch} hitSlop={10}><Text style={homeStyles.searchDone}>Done</Text></Pressable>
    </View>
    <SearchBar accessibilityLabel="Search local shops" value={query} onChangeText={setQuery} autoFocus />
    <CategoryCircles categories={categoryCounts(businesses)} selected={category} onSelect={setCategory} />
    <FeatureFilter selected={features} onChange={setFeatures} />
    <HomeCollection shops={filtered} featured={trending} memberships={memberships} catalog={catalog} filtered onSelect={onSelect} onCategory={setCategory} location={userLocation} locationStatus={locationStatus} onUseLocation={() => { void locate() }} />
    <Pressable accessibilityRole="button" onPress={() => onAsk(query)} style={({ pressed }) => [styles.askShopCard, pressed && { opacity: 0.85 }]}>
      <View style={styles.askShopIcon}><MegaphoneIcon color={schemeColor("#fff", 'fg')} size={18} /></View>
      <View style={styles.settingsRowBody}>
        <Text style={styles.askShopTitle}>{filtered.length === 0 ? "Can't find your favourite shop?" : 'Ask a shop to join'}</Text>
        <Text style={styles.askShopCopy}>Tell them local shoppers want them on The Loyalty Loop</Text>
      </View>
      <ChevronRightIcon color={colors.primaryText} size={18} />
    </Pressable>
  </>
}

// ---------------------------------------------------------------------
// Map tab — native Google map (react-native-maps). The Android SDK key
// comes from EXPO_PUBLIC_GOOGLE_MAPS_API_KEY via app.config.js and is baked
// into the AndroidManifest at build time, so changing it needs a new build.
// ---------------------------------------------------------------------

function initialsOf(name: string) {
  const letters = name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]?.toUpperCase() ?? '')
  return letters.join('') || '?'
}

// Hides Google's own business, hospital and transit labels so only our shop pins show.
const QUIET_MAP_STYLE = [
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
]

// The full-page map in dark mode: warm near-black land, muted roads and labels.
const DARK_MAP_STYLE = [
  ...QUIET_MAP_STYLE,
  { elementType: 'geometry', stylers: [{ color: '#1d1d21' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#a8a39b' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#121214' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#36363c' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2c2c32' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1d1d21' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3a3a42' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f1a2e' }] },
]

const PIN_ENDPOINT = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/map-pin`

// Android + React Native's New Architecture never report a custom marker view's
// size to react-native-maps, so view-based pins are snapshotted at 100×100 px and
// come out cut off. On Android we therefore load a server-rendered PNG of the same
// pin (supabase/functions/map-pin) through the Marker `image` prop instead.
function pinImageUrl(business: Business, color: string) {
  const scale = Math.min(4, Math.max(1, Math.round(PixelRatio.get() * 100) / 100))
  const params = [`color=${encodeURIComponent(color)}`, `initials=${encodeURIComponent(initialsOf(business.name))}`, `scale=${scale}`]
  if (business.logo_url) params.push(`logo=${encodeURIComponent(business.logo_url)}`)
  return `${PIN_ENDPOINT}?${params.join('&')}`
}

// Brand-coloured map pin: white ring, shop logo (or initials) inside, brand tail,
// soft halo and a ground shadow. Replaces the stock red Google marker.
function ShopMarker({ business, description, onPress, onCalloutPress }: { business: Business; description?: string; onPress?: () => void; onCalloutPress?: () => void }) {
  const color = business.brand_color || colors.primary
  // Android snapshots custom markers to a bitmap; keep tracking view changes until the
  // logo has painted (or a fallback timeout), then freeze it for map performance.
  const [tracksViewChanges, setTracksViewChanges] = useState(true)
  useEffect(() => {
    const timer = setTimeout(() => setTracksViewChanges(false), business.logo_url ? 6000 : 1500)
    return () => clearTimeout(timer)
  }, [business.logo_url])
  if (business.lat == null || business.lng == null) return null
  const coordinate = { latitude: business.lat, longitude: business.lng }
  if (Platform.OS === 'android') {
    return (
      <Marker
        coordinate={coordinate}
        title={business.name}
        description={description}
        anchor={{ x: 0.5, y: 0.9 }}
        image={{ uri: pinImageUrl(business, color) }}
        pinColor={color}
        onPress={onPress}
        onCalloutPress={onCalloutPress}
      />
    )
  }
  return (
    <Marker
      coordinate={coordinate}
      title={business.name}
      description={description}
      anchor={{ x: 0.5, y: 0.9 }}
      tracksViewChanges={tracksViewChanges}
      onPress={onPress}
      onCalloutPress={onCalloutPress}
    >
      <View style={styles.pinWrap} collapsable={false}>
        <View style={[styles.pinHalo, { backgroundColor: color }]} collapsable={false} />
        <View style={[styles.pinBody, { backgroundColor: color }]} collapsable={false}>
          <View style={styles.pinInner} collapsable={false}>
            {business.logo_url ? (
              <Image
                source={{ uri: business.logo_url }}
                style={styles.pinLogo}
                onLoadEnd={() => setTimeout(() => setTracksViewChanges(false), 1000)}
              />
            ) : (
              <Text style={[styles.pinInitial, { color }]}>{initialsOf(business.name)}</Text>
            )}
          </View>
        </View>
        <View style={[styles.pinTail, { borderTopColor: color }]} collapsable={false} />
        <View style={styles.pinShadow} collapsable={false} />
      </View>
    </Marker>
  )
}

function LocateIcon({ color = colors.foreground, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={6.5} stroke={color} strokeWidth={2} />
      <Circle cx={12} cy={12} r={2} fill={color} />
      <Path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  )
}

function MapShopLogo({ business, size }: { business: Business; size: number }) {
  const shape = { width: size, height: size, borderRadius: size * 0.3 }
  if (business.logo_url) return <Image source={{ uri: business.logo_url }} style={[styles.nearbyLogo, shape]} />
  return (
    <View style={[styles.nearbyLogo, shape, { backgroundColor: business.brand_color || colors.ink }]}>
      <Text style={styles.logoLetter}>{initialsOf(business.name)}</Text>
    </View>
  )
}

// The swipeable shop cards sit above the floating tab bar (10 + 68 tall).
const MAP_CARD_GAP = 12
const MAP_CARD_SIDE = 20
const MAP_CARDS_BOTTOM = 92
const MAP_CARD_WIDTH = Math.min(Dimensions.get('window').width - 72, 420)
const MAP_CARD_STEP = MAP_CARD_WIDTH + MAP_CARD_GAP

// Whole-page map: the search bar floats on top, shop cards swipe along the bottom.
// Swiping a card moves the map to that shop; tapping a pin brings its card forward.
function MapTab({ businesses, onSelect, onAsk }: { businesses: Business[]; onSelect: (business: Business) => void; onAsk: (query: string, location?: {lat:number;lng:number}) => void }) {
  const { isDark } = useTheme()
  const mapRef = useRef<MapView>(null)
  const listRef = useRef<FlatList<{ shop: Business; miles: number | null }>>(null)
  const [query, setQuery] = useState('')
  const [center, setCenter] = useState<{lat:number;lng:number}|undefined>()
  const { coords, status: locationStatus, locate } = useUserLocation()
  const goToMeWhenFound = useRef(false)

  const searchTerm = useDebouncedValue(query)
  const term = query.trim().toLowerCase()
  const matches = fuzzyFilter(businesses, searchTerm, b => [b.name, b.category, b.address])
  // Nearest first once we know where the shopper is.
  const cards = useMemo(() => {
    const pinned = businesses.filter(b => b.lat != null && b.lng != null)
    return coords ? nearestFirst(pinned, coords) : pinned.map(shop => ({ shop, miles: null as number | null }))
  }, [businesses, coords])
  const initialRegion = cards.length
    ? { latitude: cards[0].shop.lat as number, longitude: cards[0].shop.lng as number, latitudeDelta: 0.07, longitudeDelta: 0.07 }
    : undefined

  const fitAllPins = () => {
    if (cards.length < 2) return
    mapRef.current?.fitToCoordinates(
      cards.map(({ shop }) => ({ latitude: shop.lat as number, longitude: shop.lng as number })),
      { edgePadding: { top: 50, right: 50, bottom: 50, left: 50 }, animated: false },
    )
  }

  const moveTo = (shop: Business, zoomIn = false) => {
    if (shop.lat == null || shop.lng == null) return
    if (zoomIn) mapRef.current?.animateToRegion({ latitude: shop.lat, longitude: shop.lng, latitudeDelta: 0.012, longitudeDelta: 0.012 }, 400)
    else mapRef.current?.animateCamera({ center: { latitude: shop.lat, longitude: shop.lng } }, { duration: 350 })
  }
  const showCard = (shop: Business) => {
    const index = cards.findIndex(card => card.shop.id === shop.id)
    if (index >= 0) listRef.current?.scrollToOffset({ offset: index * MAP_CARD_STEP, animated: true })
  }
  const pickResult = (shop: Business) => {
    Keyboard.dismiss()
    setQuery('')
    if (shop.lat == null || shop.lng == null) { onSelect(shop); return }
    moveTo(shop, true)
    // The cards are hidden while results show; wait for them to come back.
    setTimeout(() => showCard(shop), 80)
  }

  const flyToMe = (at: {lat:number;lng:number}) => mapRef.current?.animateToRegion({ latitude: at.lat, longitude: at.lng, latitudeDelta: 0.03, longitudeDelta: 0.03 }, 400)
  const goToMe = () => {
    if (coords) { flyToMe(coords); return }
    goToMeWhenFound.current = true
    void locate()
  }
  useEffect(() => {
    if (coords && goToMeWhenFound.current) { goToMeWhenFound.current = false; flyToMe(coords) }
  }, [coords])
  const canLocate = locationStatus === 'ask' || locationStatus === 'locating' || locationStatus === 'ready'

  return (
    <View style={styles.mapPage}>
      {cards.length > 0 ? (
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          customMapStyle={isDark ? DARK_MAP_STYLE : QUIET_MAP_STYLE}
          showsPointsOfInterest={false}
          style={StyleSheet.absoluteFill}
          initialRegion={initialRegion}
          rotateEnabled={false}
          toolbarEnabled={false}
          showsUserLocation={locationStatus === 'ready'}
          showsMyLocationButton={false}
          mapPadding={{ top: 84, right: 0, bottom: MAP_CARDS_BOTTOM + 112, left: 0 }}
          onMapReady={fitAllPins}
          onPress={() => Keyboard.dismiss()}
          onRegionChangeComplete={region => setCenter({lat:region.latitude,lng:region.longitude})}
        >
          {cards.map(({ shop }) => (
            <ShopMarker key={shop.id} business={shop} onPress={() => showCard(shop)} onCalloutPress={() => onSelect(shop)} />
          ))}
        </MapView>
      ) : (
        <View style={styles.mapEmpty}>
          <MapPinIcon color={colors.primaryText} size={30} />
          <Text style={styles.mapPlaceholderText}>No shops have a pinned location yet.</Text>
        </View>
      )}

      <View style={styles.mapTop} pointerEvents="box-none">
        <SearchBar floating placeholder="Search shops or categories" accessibilityLabel="Search shops on map" value={query} onChangeText={setQuery} />
        {term.length > 0 && (
          <View style={styles.mapResults}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {matches.map((shop, index) => (
                <Pressable key={shop.id} accessibilityRole="button" onPress={() => pickResult(shop)} style={({ pressed }) => [styles.mapResultRow, index > 0 && styles.mapResultDivider, pressed && styles.settingsRowPressed]}>
                  <MapShopLogo business={shop} size={38} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.mapResultName} numberOfLines={1}>{shop.name}</Text>
                    <Text style={styles.mapResultMeta} numberOfLines={1}>{[shop.category || 'Local business', shop.address ? formatAddress(shop.address) : null].filter(Boolean).join(' · ')}</Text>
                  </View>
                </Pressable>
              ))}
              {matches.length === 0 && (
                <Pressable accessibilityRole="button" onPress={() => { Keyboard.dismiss(); onAsk(query, center) }} style={({ pressed }) => [styles.mapResultRow, pressed && styles.settingsRowPressed]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.mapResultName}>No shops match “{query.trim()}”</Text>
                    <Text style={[styles.mapResultMeta, { color: colors.primaryText, fontWeight: '700' }]}>Can't find your favourite shop? Ask them to join</Text>
                  </View>
                </Pressable>
              )}
            </ScrollView>
          </View>
        )}
      </View>

      {term.length === 0 && cards.length > 0 && (
        <View style={styles.mapBottom} pointerEvents="box-none">
          {canLocate && (
            <Pressable accessibilityRole="button" accessibilityLabel="Show my location" onPress={goToMe} style={({ pressed }) => [styles.mapLocate, pressed && styles.pressed]}>
              {locationStatus === 'locating' && !coords ? <WhirlSpinner size={18} color={colors.primaryText} /> : <LocateIcon color={colors.primaryText} />}
            </Pressable>
          )}
          <FlatList
            ref={listRef}
            data={cards}
            horizontal
            keyExtractor={({ shop }) => shop.id}
            showsHorizontalScrollIndicator={false}
            snapToInterval={MAP_CARD_STEP}
            decelerationRate="fast"
            contentContainerStyle={styles.mapCards}
            onMomentumScrollEnd={event => {
              const card = cards[Math.round(event.nativeEvent.contentOffset.x / MAP_CARD_STEP)]
              if (card) moveTo(card.shop)
            }}
            renderItem={({ item: { shop, miles } }) => {
              const open = openStatus(shop.opening_hours)
              return (
                <Pressable accessibilityRole="button" accessibilityLabel={`Open ${shop.name}`} onPress={e => { markCardOrigin(shop.id, e.currentTarget, { color: schemeColor('#fff', 'bg'), radius: 24 }); onSelect(shop) }} style={({ pressed }) => [styles.mapCard, pressed && styles.mapCardPressed]}>
                  <MapShopLogo business={shop} size={56} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.shopName} numberOfLines={1}>{shop.name}</Text>
                    <Text style={styles.nearbyCategory} numberOfLines={1}>{[ratingLabel(shop), shop.category || 'Local business'].filter(Boolean).join(' · ')}</Text>
                    <Text style={styles.mapCardMeta} numberOfLines={1}>
                      {miles != null && <Text style={styles.mapCardMiles}>{formatMiles(miles)}</Text>}
                      {miles != null && (open || shop.address) ? ' · ' : ''}
                      {open ? <Text style={{ color: open.open ? schemeColor('#1E7A46', 'fg') : schemeColor('#8A857C', 'fg') }}>{open.label}</Text> : shop.address ? formatAddress(shop.address) : ''}
                    </Text>
                  </View>
                  <ArrowRightIcon />
                </Pressable>
              )
            }}
          />
        </View>
      )}
    </View>
  )
}

// ---------------------------------------------------------------------
// Admin-authored banner — dismissed for the current app session only
// (resets on next launch, same as everything else fetched in load()).
// ---------------------------------------------------------------------

function PlatformBanner({ notices, dismissedIds, onDismiss }: { notices: PlatformNotice[]; dismissedIds: Set<string>; onDismiss: (id: string) => void }) {
  const visible = notices.filter((notice) => !dismissedIds.has(notice.id))
  if (!visible.length) return null
  return (
    <View>
      {visible.map((notice) => (
        <View key={notice.id} style={styles.platformBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.platformBannerText}>
              {notice.title}
              {notice.body ? <Text style={styles.platformBannerBody}>: {notice.body}</Text> : null}
            </Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Dismiss: ${notice.title}`} onPress={() => onDismiss(notice.id)} hitSlop={14}>
            <CloseIcon size={16} color={schemeColor("#fff", 'fg')} />
          </Pressable>
        </View>
      ))}
    </View>
  )
}

// ---------------------------------------------------------------------
// News tab
// ---------------------------------------------------------------------

/** What a list tab shows when it has nothing to list: placeholders while the first load runs,
 * a retry line if it failed, otherwise the tab's own empty message. */
type ListLoad = { loading: boolean; failed: boolean; onRetry: () => void }
function EmptyList({ loading, failed, onRetry, children }: ListLoad & { children: ReactNode }) {
  if (loading) return <View style={{ gap: 12 }} accessibilityLabel="Loading"><SkeletonBlock height={120} radius={18} /><SkeletonBlock height={120} radius={18} /></View>
  if (failed) {
    return (
      <View style={{ alignItems: 'center', marginTop: 8 }}>
        <Text style={[styles.empty, { textAlign: 'center' }]}>We couldn’t load this. Check your connection and try again.</Text>
        <Button secondary title="Try again" onPress={onRetry} />
      </View>
    )
  }
  return <>{children}</>
}

function NewsTab({ announcements, load }: { announcements: Announcement[]; load: ListLoad }) {
  return (
    <>
      <Text style={styles.pageTitle}>News from your shops</Text>
      {announcements.length === 0 && <EmptyList {...load}><View style={{ alignItems: 'center', marginTop: 8 }}><Whirl pose="sleepy" size={120} /><Text style={[styles.empty, { textAlign: 'center' }]}>Quiet in here. When your shops have news, you’ll see it first.</Text></View></EmptyList>}
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
// Discover tab — full-screen, swipeable feed of shop gallery photos.
// ---------------------------------------------------------------------

function timeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks}w ago`
  return new Date(iso).toLocaleDateString()
}

function DiscoverCard({
  photo,
  height,
  favourite,
  onToggleFavourite,
  onOpenShop,
}: {
  photo: GalleryPhoto
  height: number
  favourite: boolean
  onToggleFavourite: () => void
  onOpenShop: () => void
}) {
  return (
    <View style={{ height, width: '100%' }}>
      <Image source={{ uri: photo.url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.05)', 'rgba(0,0,0,0.72)']}
        locations={[0, 0.45, 1]}
        style={styles.discoverGradient}
      />
      <View style={styles.discoverActionRail}>
        <Pressable onPress={onToggleFavourite} style={({ pressed }) => [styles.discoverActionButton, pressed && styles.pressed]} hitSlop={10}>
          <HeartIcon color={favourite ? colors.primary : schemeColor('#fff', 'fg')} filled={favourite} size={27} />
        </Pressable>
        <Pressable
          onPress={() => {
            void Share.share({ message: `Check out ${photo.business.name} on The Loyalty Loop!` })
          }}
          style={({ pressed }) => [styles.discoverActionButton, pressed && styles.pressed]}
          hitSlop={10}
        >
          <ShareIcon size={25} />
        </Pressable>
      </View>
      <Pressable style={({ pressed }) => [styles.discoverInfo, pressed && styles.pressed]} onPress={onOpenShop}>
        <View style={styles.discoverShopRow}>
          {photo.business.logo_url ? (
            <Image source={{ uri: photo.business.logo_url }} style={styles.discoverLogo} />
          ) : (
            <View style={[styles.discoverLogo, { backgroundColor: photo.business.brand_color || colors.ink }]} />
          )}
          <Text style={styles.discoverShopName} numberOfLines={1}>
            {photo.business.name}
          </Text>
          <CheckBadgeIcon />
          <Text style={styles.discoverTime}>· {timeAgo(photo.created_at)}</Text>
        </View>
        {!!photo.business.description && (
          <Text numberOfLines={2} style={styles.discoverCaption}>
            {photo.business.description}
          </Text>
        )}
        <Text style={styles.discoverViewShop}>View shop</Text>
      </Pressable>
    </View>
  )
}

function DiscoverTab({
  favouriteIds,
  onToggleFavourite,
  onOpenShop,
  onBack,
}: {
  favouriteIds: Set<string>
  onToggleFavourite: (business: Business) => void
  onOpenShop: (business: Business) => void
  onBack: () => void
}) {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [containerHeight, setContainerHeight] = useState(0)
  const feedHeight = containerHeight || Dimensions.get('window').height
  const insets = useSafeAreaInsets()

  useEffect(() => {
    let active = true
    supabase
      .from('business_photos')
      .select('id,url,created_at,business:businesses(*)')
      .order('created_at', { ascending: false })
      .limit(60)
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          setLoading(false)
          return
        }
        const rows = (data || [])
          .map((row: any) => ({ ...row, business: Array.isArray(row.business) ? row.business[0] : row.business }))
          .filter((row: any) => row.business) as GalleryPhoto[]
        setPhotos(rows)
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  return (
    <View style={{ flex: 1 }} onLayout={(e) => setContainerHeight(e.nativeEvent.layout.height)}>
      <Pressable
        onPress={onBack}
        hitSlop={12}
        style={[styles.discoverBack, { top: insets.top + 12 }]}
      >
        <ArrowLeftIcon />
      </Pressable>
      {loading ? (
        <View style={[styles.discoverEmpty, { height: feedHeight }]}>
          <WhirlSpinner size={28} />
        </View>
      ) : photos.length === 0 ? (
        <View style={[styles.discoverEmpty, { height: feedHeight }]}>
          <ReelsIcon color={colors.primaryText} size={30} />
          <Text style={styles.discoverEmptyText}>No shop photos yet. Check back soon.</Text>
        </View>
      ) : (
        <FlatList
          data={photos}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <DiscoverCard
              photo={item}
              height={feedHeight}
              favourite={favouriteIds.has(item.business.id)}
              onToggleFavourite={() => onToggleFavourite(item.business)}
              onOpenShop={() => onOpenShop(item.business)}
            />
          )}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={feedHeight}
          snapToAlignment="start"
          bounces={false}
        />
      )}
    </View>
  )
}

// ---------------------------------------------------------------------
// Rewards tab
// ---------------------------------------------------------------------

function RewardsTab({ rewards, load }: { rewards: Reward[]; load: ListLoad }) {
  const active = rewards.filter((r) => !r.redeemed_at)
  return (
    <>
      <Text style={styles.pageTitle}>Ready to enjoy</Text>
      {active.length ? (
        active.map((reward, index) => (
          <Ticket
            key={reward.id}
            index={index}
            color={reward.business?.brand_color || colors.primary}
            shopName={reward.business?.name || 'The Loyalty Loop shop'}
            title={reward.title}
            code={reward.short_code}
            expiresAt={reward.expires_at}
            pageColor={colors.background}
          >
            <QRCode value={encodeRewardQr(reward.qr_token)} size={150} />
          </Ticket>
        ))
      ) : (
        <EmptyList {...load}><View style={{ alignItems: 'center', marginTop: 8 }}><Whirl pose="sleepy" size={120} /><Text style={[styles.empty, { textAlign: 'center' }]}>Nothing to claim yet. Get a few stamps and your first reward lands right here.</Text></View></EmptyList>
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
  load,
}: {
  favourites: Business[]
  memberships: Membership[]
  onSelect: (business: Business) => void
  onQuickJoin: (business: Business) => void
  load: ListLoad
}) {
  // Each favourite's whole card, so "View" grows the card (not the link) into the page.
  const cardRefs = useRef(new Map<string, View>())
  return (
    <>
      <Text style={styles.pageTitle}>Favourites</Text>
      {favourites.length === 0 && <EmptyList {...load}><View style={{ alignItems: 'center', marginTop: 8 }}><Whirl pose="think" size={120} /><Text style={[styles.empty, { textAlign: 'center' }]}>No favourites yet. Tap the heart on any shop you like and it’ll live here.</Text></View></EmptyList>}
      {favourites.map((b) => {
        const member = memberships.some((m) => m.business_id === b.id)
        return (
          <View key={b.id} ref={el => { if (el) cardRefs.current.set(b.id, el); else cardRefs.current.delete(b.id) }} style={styles.favouriteCard}>
            <View style={styles.favouriteTopRow}>
              {b.logo_url ? (
                <Image source={{ uri: b.logo_url }} style={styles.favouriteLogo} />
              ) : (
                <View style={[styles.favouriteLogo, { backgroundColor: b.brand_color || colors.ink }]}>
                  <Text style={styles.logoLetter}>{b.name[0]}</Text>
                </View>
              )}
            </View>
            <Text style={styles.shopName}>{b.name}</Text>
            <Text style={styles.categoryLabel}>{b.category || 'Local business'}</Text>
            <View style={styles.favouriteDivider} />
            <View style={styles.favouriteBottomRow}>
              {member ? (
                <Text style={styles.favouriteStatus}>Member</Text>
              ) : (
                <Pressable accessibilityRole="button" accessibilityLabel={`Join ${b.name}`} onPress={() => onQuickJoin(b)} style={styles.favouriteTapRow}>
                  <View style={[styles.favouriteDot, { backgroundColor: b.brand_color || colors.primary }]} />
                  <Text style={styles.favouriteStatus}>Tap to join</Text>
                </Pressable>
              )}
              <Pressable accessibilityRole="button" accessibilityLabel={`View ${b.name}`} onPress={() => { markCardOrigin(b.id, cardRefs.current.get(b.id), { color: colors.card, radius: 20 }); onSelect(b) }} style={styles.favouriteViewRow}>
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

// Temporarily hidden (2026-09-12) at the owner's request. Flip to true to bring the
// Discover tab back in the bottom bar; everything behind it is untouched.
const SHOW_DISCOVER_TAB = false

// Floating indigo pill: the open tab is a paper pill with its name, the rest are icons.
const TAB_ON = '#1A2138'
const TAB_OFF = '#D5D9E8' // 7:1+ on the indigo bar in light (#2B3A67) and dark (#34457F)
const TABS: { id: Tab; label: string; icon: (active: boolean) => React.ReactNode }[] = [
  { id: 'home', label: 'Home', icon: (active) => <HomeIcon color={active ? TAB_ON : TAB_OFF} /> },
  { id: 'discover', label: 'Discover', icon: (active) => <ReelsIcon color={active ? TAB_ON : TAB_OFF} filled={active} /> },
  { id: 'map', label: 'Map', icon: (active) => <MapPinIcon color={active ? TAB_ON : TAB_OFF} /> },
  { id: 'news', label: 'News', icon: (active) => <MegaphoneIcon color={active ? TAB_ON : TAB_OFF} /> },
  { id: 'rewards', label: 'Rewards', icon: (active) => <GiftIcon color={active ? TAB_ON : TAB_OFF} /> },
  { id: 'favourites', label: 'Saved', icon: (active) => <HeartIcon color={active ? TAB_ON : TAB_OFF} filled={active} /> },
]

function BottomTabBar({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  return (
    <View style={styles.tabs}>
      {TABS.filter(({ id }) => id !== 'discover' || SHOW_DISCOVER_TAB).map(({ id, label, icon }) => {
        const active = tab === id
        return (
          <Pressable key={id} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: active }} style={({ pressed }) => [styles.tab, active && styles.tabActive, pressed && styles.pressed]} onPress={() => onChange(id)}>
            {icon(active)}
            {active && <Text style={styles.tabTextActive} numberOfLines={1}>{label}</Text>}
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
  const { isDark } = useTheme()
  const [askShop, setAskShop] = useState<{query:string;location?:{lat:number;lng:number}}|null>(null)
  const [tab, setTab] = useState<Tab>('home')
  // Last home screen saved on this phone, so the app never opens blank.
  const [cached] = useState(() => readHomeCache(session.user.id))
  const [savedAt, setSavedAt] = useState<number | null>(cached?.savedAt ?? null)
  const serviceStatus = useServiceStatus('shopper')
  const [businesses, setBusinesses] = useState<Business[]>(() => (cached?.businesses ?? []) as Business[])
  const [memberships, setMemberships] = useState<Membership[]>(() => (cached?.memberships ?? []) as Membership[])
  const [homeCatalog, setHomeCatalog] = useState<HomeTier[]>(() => (cached?.homeCatalog ?? []) as HomeTier[])
  const [rewards, setRewards] = useState<Reward[]>(() => (cached?.rewards ?? []) as Reward[])
  const [celebrate, setCelebrate] = useState<Reward | null>(null)
  const [announcements, setAnnouncements] = useState<Announcement[]>(() => (cached?.announcements ?? []) as Announcement[])
  const [platformNotices, setPlatformNotices] = useState<PlatformNotice[]>([])
  const [dismissedNoticeIds, setDismissedNoticeIds] = useState<Set<string>>(new Set())
  const [favouriteIds, setFavouriteIds] = useState<Set<string>>(() => new Set(cached?.favouriteIds ?? []))
  const [selected, setSelected] = useState<Business | null>(null)
  // The shop opened from "Show my card", so its page opens at the code.
  const [codeShopId, setCodeShopId] = useState<string | null>(null)
  // Each open is its own page instance, so a card tapped again (even mid-close) grows afresh.
  const [openCount, setOpenCount] = useState(0)
  const openShop = (business: Business) => { setOpenCount(n => n + 1); setSelected(business) }
  const shopKey = selected ? `${selected.id}:${openCount}` : null
  const shopKeyRef = useRef(shopKey)
  shopKeyRef.current = shopKey
  const shopPage = useRef<CardGrowHandle>(null)
  // Back shrinks the page into the card it came from (or cuts, when it came from elsewhere).
  const closeShop = () => { if (shopPage.current) shopPage.current.close(); else setSelected(null) }
  const showCard = (business: Business) => { setCodeShopId(business.id); openShop(business) }
  useEffect(() => { if (!selected) setCodeShopId(null) }, [selected])
  const [showProfile, setShowProfile] = useState(false)
  const [stampCode, setStampCode] = useState<string | null>(cached?.stampCode ?? null)
  const [loading, setLoading] = useState(!cached)
  // Whether this phone has ever had a home screen for this shopper (saved copy or a load this
  // session). Until then an empty list means "not loaded yet", not "nothing there".
  const [everLoaded, setEverLoaded] = useState(!!cached)
  const [loadFailed, setLoadFailed] = useState(false)
  const userId = session.user.id
  const shopperCountry = useCountry(userId)
  const linking = useCardLinking(userId)
  // Card-linking only runs where the country supports it (the UK today).
  const cardLinking = useMemo(() => ({ ...linking, enabled: linking.enabled && shopperCountry.country.card_linking }), [linking, shopperCountry.country.card_linking])
  const [settingsView, setSettingsView] = useState<SettingsView>('root')
  const [cardLinked, setCardLinked] = useState(false)
  const linkedMessage = useRef('')

  function showLinkOutcome(outcome: LinkOutcome) {
    if (outcome.kind === 'linked') {
      linkedMessage.current = `${outcome.card ? cardLabel(outcome.card) : 'Your card'} is linked. You’ll earn automatically at shops marked ⚡.`
      setCardLinked(true)
    } else if (outcome.kind === 'pending') {
      showAlert('Almost done', 'We’re finishing linking your card. It will appear in Linked cards shortly.')
    } else if (outcome.kind === 'error') {
      showAlert(outcome.title, outcome.message)
    }
  }

  /** On iOS, Fidel's card screen can't appear above an open sheet, so the
   * account sheet closes first and reopens on Linked cards afterwards. */
  async function linkCardFromSettings() {
    let closedSheet = false
    const outcome = await cardLinking.link(Platform.OS === 'ios' ? async () => {
      closedSheet = true
      setShowProfile(false)
      await new Promise((resolve) => setTimeout(resolve, 650))
    } : undefined)
    if (closedSheet) {
      setSettingsView('cards')
      setShowProfile(true)
      // Let the sheet finish presenting before the success check (itself a
      // modal) or an alert tries to present on top of it.
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    showLinkOutcome(outcome)
  }

  async function linkCardFromShop() {
    showLinkOutcome(await cardLinking.link())
  }

  const cardLinkedCheck = (
    <SuccessCheck
      visible={cardLinked}
      onFinished={() => {
        setCardLinked(false)
        showAlert('Card linked', linkedMessage.current)
      }}
    />
  )

  useEffect(() => { void trackUsageEvent(userId, 'tab_viewed', tab) }, [tab, userId])
  useEffect(() => { void refreshWalkPast() }, [])
  useEffect(() => { if (selected) void trackUsageEvent(userId, 'shop_opened') }, [selected?.id, userId])
  const coldStartPushHandled = useRef(false)
  useEffect(() => {
    if (!businesses.length) return
    const open = (response: Notifications.NotificationResponse) => {
      const data = (response.notification.request.content.data ?? {}) as { businessId?: string | null; announcementId?: string | null }
      const business = data.businessId ? businesses.find((b) => b.id === data.businessId) : undefined
      if (business) setSelected(business)
      else if (data.announcementId) setTab('news')
    }
    if (!coldStartPushHandled.current) {
      coldStartPushHandled.current = true
      void Notifications.getLastNotificationResponseAsync().then((response) => { if (response) open(response) })
    }
    const subscription = Notifications.addNotificationResponseReceivedListener(open)
    return () => subscription.remove()
  }, [businesses])

  const load = async () => {
    setLoading(true)
    try {
      if (simulatedOutage()) throw new Error('Simulated outage')
      const platformTargetColumn = Platform.OS === 'ios' ? 'target_shopper_ios' : 'target_shopper_android'
      const twelveMonthsAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()
      const [shops, memberRows, earned, news, favs, profile, notices, catalogRows, levelRows, pointsRows, spendRows, ratings] = await Promise.all([
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
        supabase.from('profiles').select('stamp_code').eq('id', userId).single(),
        supabase
          .from('platform_announcements')
          .select('id,title,body')
          .eq('is_active', true)
          .eq(platformTargetColumn, true)
          .order('created_at', { ascending: false }),
        supabase.from('reward_catalog').select('business_id,title,stamp_threshold,spend_threshold_pence'),
        // Membership levels and points costs exist only once the programme
        // migration is applied; a failed read just leaves those cards without a target.
        supabase.from('membership_tiers').select('business_id,name,spend_threshold_pence'),
        supabase.from('reward_catalog').select('business_id,title,points_cost').gt('points_cost', 0),
        supabase.from('transactions').select('business_id,value').eq('user_id', userId).eq('type', 'spend').is('voided_at', null).gte('created_at', twelveMonthsAgo),
        // Star summaries for every shop, so people can see them before joining.
        supabase.from('reviews').select('business_id,rating'),
      ])
      if (shops.error) throw shops.error
      if (memberRows.error) throw memberRows.error
      if (earned.error) throw earned.error
      if (news.error) throw news.error
      if (favs.error) throw favs.error
      setPlatformNotices(notices.error ? [] : ((notices.data || []) as PlatformNotice[]))
      const levelCatalog: HomeTier[] = levelRows.error ? [] : (levelRows.data || []).map((row: any) => ({
        business_id: row.business_id, title: row.name, stamp_threshold: 0, spend_threshold_pence: row.spend_threshold_pence, kind: 'tier',
      }))
      const pointsCatalog: HomeTier[] = pointsRows.error ? [] : (pointsRows.data || []).map((row: any) => ({
        business_id: row.business_id, title: row.title, stamp_threshold: 0, points_cost: row.points_cost,
      }))
      setHomeCatalog([...(catalogRows.error ? [] : (catalogRows.data || [])), ...levelCatalog, ...pointsCatalog])
      // Spend in the last 12 months per shop (own rows only), for the tier distance.
      const rollingByShop = new Map<string, number>()
      if (!spendRows.error) {
        for (const row of (spendRows.data || []) as { business_id: string; value: number }[]) {
          rollingByShop.set(row.business_id, (rollingByShop.get(row.business_id) ?? 0) + (row.value || 0))
        }
      }
      const stats = ratingStats(ratings.error ? [] : ratings.data || [])
      setBusinesses((shops.data || []).map((shop: Business) => ({ ...shop, ...stats.get(shop.id) })))
      setMemberships((memberRows.data || []).map((m: any) => ({ ...m, rolling_spend_pence: spendRows.error ? null : rollingByShop.get(m.business_id) ?? 0 })))
      const rewardList: Reward[] = (earned.data || []).map((r: any) => ({ ...r, business: Array.isArray(r.business) ? r.business[0] : r.business }))
      setRewards(rewardList)
      void unseenReward(rewardList).then(fresh => { if (fresh) setCelebrate(fresh) })
      // Only shops this customer has actually joined (and hasn't opted out of
      // promos from) — otherwise every shop on the platform shows up here.
      const newsMemberBusinessIds = new Set(
        (memberRows.data || []).filter((m: any) => !m.promos_opted_out).map((m: any) => m.business_id as string)
      )
      setAnnouncements(
        (news.data || [])
          .filter((a: any) => newsMemberBusinessIds.has(a.business_id))
          .map((a: any) => ({ ...a, business: Array.isArray(a.business) ? a.business[0] : a.business }))
      )
      setFavouriteIds(new Set((favs.data || []).map((row: any) => row.business_id as string)))
      setStampCode(profile.data?.stamp_code || null)
      void syncShopperWidget(shops.data || [], memberRows.data || []).catch(() => undefined)
      const announcementsToSave = (news.data || [])
        .filter((a: any) => newsMemberBusinessIds.has(a.business_id))
        .map((a: any) => ({ ...a, business: Array.isArray(a.business) ? a.business[0] : a.business }))
      setSavedAt(writeHomeCache(userId, {
        businesses: (shops.data || []).map((shop: Business) => ({ ...shop, ...stats.get(shop.id) })),
        memberships: (memberRows.data || []).map((m: any) => ({ ...m, rolling_spend_pence: spendRows.error ? null : rollingByShop.get(m.business_id) ?? 0 })),
        rewards: rewardList,
        announcements: announcementsToSave,
        homeCatalog: [...(catalogRows.error ? [] : (catalogRows.data || [])), ...levelCatalog, ...pointsCatalog],
        favouriteIds: (favs.data || []).map((row: any) => row.business_id as string),
        stampCode: profile.data?.stamp_code || null,
      }))
      setEverLoaded(true)
      setLoadFailed(false)
      if (serviceStatus.level !== 'ok') serviceStatus.recheck()
    } catch (e) {
      setLoadFailed(true)
      // Servers down or no signal: keep showing the saved home screen and let
      // the banner explain. Only pop up when there is nothing to show at all.
      serviceStatus.recheck()
      if (!businesses.length) showAlert('Could not refresh', 'We couldn’t reach our servers. Pull down to try again in a moment.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  // When our servers come back, refresh straight away.
  const wasDown = useRef(false)
  useEffect(() => {
    if (serviceStatus.level !== 'ok') wasDown.current = true
    else if (wasDown.current && serviceStatus.checkedAt) {
      wasDown.current = false
      void load()
    }
  }, [serviceStatus.level, serviceStatus.checkedAt])

  // Shop changes, live: a new card design, or a shop switching or editing its
  // programme (reward model, AI-designed rules, rewards, levels). The whole shop
  // row is refreshed, plus the reward lists, and the open shop page reloads its
  // rewards via programmeVersion. Bursts (one save touches several rows) are
  // batched into one refetch; also runs when the app comes back to the front.
  const [programmeVersion, setProgrammeVersion] = useState(0)
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refreshShops = async () => {
      const [shops, catalog] = await Promise.all([
        supabase.from('businesses').select('*').eq('is_active', true),
        fetchHomeCatalog(),
      ]);
      if (!active) return;
      if (!shops.error && shops.data) {
        const fresh = new Map((shops.data as Business[]).map(row => [row.id, row]));
        // Keep fields the list adds itself (star ratings); take everything else fresh.
        setBusinesses(rows => rows.map(row => fresh.has(row.id) ? { ...row, ...fresh.get(row.id) } : row));
        setSelected(row => row && fresh.has(row.id) ? { ...row, ...fresh.get(row.id) } : row);
      }
      if (catalog) setHomeCatalog(catalog);
      setProgrammeVersion(v => v + 1);
    };
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { timer = null; void refreshShops(); }, 300);
    };
    const channel = supabase
      .channel('shop-changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'businesses' }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reward_catalog' }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'membership_tiers' }, schedule)
      .subscribe(status => { if (status === 'SUBSCRIBED') schedule(); });
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') schedule(); });
    return () => { active = false; if (timer) clearTimeout(timer); foreground.remove(); void supabase.removeChannel(channel); };
  }, [userId])

  // Live balances: when staff award a stamp, points or spend at the counter,
  // the database pushes this shopper's own membership/reward rows here and the
  // card updates while they watch (the open shop page then prints the receipt
  // and lands the stamp). One award can touch several rows in a burst, so
  // changes are batched into a single quiet refetch. Also refreshes when the
  // app comes back to the front, in case the socket slept in the background.
  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setTimeout> | null = null
    const refreshLoyalty = async () => {
      const twelveMonthsAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()
      const [memberRows, earned, spendRows] = await Promise.all([
        supabase.from('memberships').select('*').eq('user_id', userId),
        supabase
          .from('rewards')
          .select('id,user_id,business_id,title,qr_token,short_code,expires_at,redeemed_at,created_at,business:businesses(name,brand_color,logo_url)')
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
        supabase.from('transactions').select('business_id,value').eq('user_id', userId).eq('type', 'spend').is('voided_at', null).gte('created_at', twelveMonthsAgo),
      ])
      if (!active) return
      if (!memberRows.error) {
        const rollingByShop = new Map<string, number>()
        for (const row of (spendRows.data || []) as { business_id: string; value: number }[]) {
          rollingByShop.set(row.business_id, (rollingByShop.get(row.business_id) ?? 0) + (row.value || 0))
        }
        setMemberships((memberRows.data || []).map((m: any) => ({ ...m, rolling_spend_pence: spendRows.error ? null : rollingByShop.get(m.business_id) ?? 0 })))
      }
      if (!earned.error) {
        const rewardList: Reward[] = (earned.data || []).map((r: any) => ({ ...r, business: Array.isArray(r.business) ? r.business[0] : r.business }))
        setRewards(rewardList)
        void unseenReward(rewardList).then(fresh => { if (active && fresh) { haptic.celebrate(); setCelebrate(fresh) } })
      }
    }
    const schedule = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { timer = null; void refreshLoyalty() }, 250)
    }
    const filter = `user_id=eq.${userId}`
    const channel = supabase
      .channel(`loyalty-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'memberships', filter }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rewards', filter }, schedule)
      .subscribe()
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') schedule() })
    return () => {
      active = false
      if (timer) clearTimeout(timer)
      foreground.remove()
      void supabase.removeChannel(channel)
    }
  }, [userId])

  useEffect(() => {
    const openWidgetDestination = ({ url }: { url: string }) => {
      if (url.includes('widget/qr')) {
        setSelected(null)
        setSettingsView('card')
        setShowProfile(true)
      }
      if (url.includes('widget/rewards')) {
        setSelected(null)
        setShowProfile(false)
        setTab('rewards')
      }
    }
    void Linking.getInitialURL().then((url) => { if (url) openWidgetDestination({ url }) })
    const subscription = Linking.addEventListener('url', openWidgetDestination)
    return () => subscription.remove()
  }, [])

  async function toggleFavourite(business: Business) {
    const isFav = favouriteIds.has(business.id)
    // Optimistic: the heart changes straight away, and goes back if saving fails.
    const apply = (favourite: boolean) =>
      setFavouriteIds((prev) => {
        const next = new Set(prev)
        if (favourite) next.add(business.id)
        else next.delete(business.id)
        return next
      })
    apply(!isFav)
    haptic.select()
    try {
      const { error } = isFav
        ? await supabase.from('favourites').delete().eq('user_id', userId).eq('business_id', business.id)
        : await supabase.from('favourites').insert({ user_id: userId, business_id: business.id })
      // Already saved (a double tap, or saved on another phone): that's the result we wanted.
      if (error && error.code !== '23505') throw error
      void trackUsageEvent(userId, isFav ? 'favourite_removed' : 'favourite_added')
    } catch {
      apply(isFav)
      showAlert('Could not update favourites', 'Check your connection and try again.')
    }
  }

  async function quickJoin(business: Business) {
    try {
      const { error } = await supabase.from('memberships').upsert({ user_id: userId, business_id: business.id }, { onConflict: 'user_id,business_id' })
      // Already a member (e.g. stale UI after joining elsewhere) — not a real failure.
      if (error && error.code !== '23505') throw error
      await load()
      void trackUsageEvent(userId, 'loyalty_card_joined')
      void afterJoin(business.name)
    } catch (e) {
      showAlert('Could not join', e instanceof Error ? e.message : 'Please try again.')
    }
  }

  // The very first join ever gets one warm "you're in" pop-up from Whirl (once, never again; skipped when Show Whirl is off).
  // The notification ask waits until it is dismissed, so two prompts never stack.
  const whirlStorage = useWhirlStorage()
  const { showWhirl: whirlOn } = useWhirlSettings()
  async function afterJoin(shopName?: string) {
    try {
      if (whirlOn && (await shouldShowOnce(whirlStorage, 'first-join'))) {
        await markSeen(whirlStorage, 'first-join')
        showAlert("You're in!", `${shopName ? shopName + ' is' : 'Your card is'} on your home screen. Show it at the till and your first stamp is yours.`, [{ text: 'Lovely', onPress: () => void maybeAskPing() }], { whirl: 'celebrate' })
        return
      }
    } catch { /* fall through to the normal flow */ }
    void maybeAskPing()
  }

  // Notifications are asked for once, right after a first join, when a ping
  // about a reward actually means something. Never on launch.
  const [askPing, setAskPing] = useState(false)
  async function maybeAskPing() {
    try {
      if ((await pushPermission()) !== 'undetermined') return
      if ((await SecureStore.getItemAsync('push_ping_asked')) === 'yes') return
      await SecureStore.setItemAsync('push_ping_asked', 'yes')
      setTimeout(() => setAskPing(true), 900)
    } catch { /* never block joining on this */ }
  }
  async function turnOnPings() {
    setAskPing(false)
    await registerPushToken(userId, { ask: true }).catch(() => undefined)
  }
  const pingSheet = (
    <Sheet visible={askPing} onClose={() => setAskPing(false)} sheetStyle={styles.pingSheet}>
      <SafeAreaView edges={['bottom']}>
        <View style={styles.pingHandle} />
        <Whirl pose="wave" size={84} style={{ marginBottom: 6 }} />
        <Text accessibilityRole="header" style={styles.pingTitle}>Want a nudge when a reward is ready?</Text>
        <Text style={styles.pingCopy}>We’ll tap you when a reward is ready and when your shops have news. That’s all. Promise.</Text>
        <View style={styles.pingRow}>
          <Pressable accessibilityRole="button" onPress={() => setAskPing(false)} style={({ pressed }) => [styles.pingButton, styles.pingNotNow, pressed && { opacity: 0.75 }]}><Text style={styles.pingNotNowText}>Not now</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => void turnOnPings()} style={({ pressed }) => [styles.pingButton, styles.pingOn, pressed && { opacity: 0.75 }]}><Text style={styles.pingOnText}>Yes please</Text></Pressable>
        </View>
      </SafeAreaView>
    </Sheet>
  )

  // A card tapped Join on before signing up is joined as soon as they're in.
  const pendingHandled = useRef(false)
  useEffect(() => {
    const shop = pendingJoin
    if (!shop || pendingHandled.current) return
    pendingHandled.current = true
    ;(async () => {
      try {
        const { error } = await supabase.from('memberships').upsert({ user_id: userId, business_id: shop.id }, { onConflict: 'user_id,business_id' })
        if (error && error.code !== '23505') throw error
        const { data: row } = await supabase.from('memberships').select('*').eq('user_id', userId).eq('business_id', shop.id).maybeSingle()
        if (row) setMemberships(prev => [...prev.filter(x => x.business_id !== shop.id), { ...(row as Membership), rolling_spend_pence: 0 }])
        void trackUsageEvent(userId, 'loyalty_card_joined', 'after_sign_up')
        void afterJoin(shop.name)
      } catch (e) {
        pendingJoin = null
        showAlert('Could not join', `${shop.name}: ${e instanceof Error ? e.message : 'Please try again from the shop page.'}`)
      }
    })()
  }, [userId])
  // …and its card opens once the shop list has it.
  useEffect(() => {
    const shop = pendingJoin
    if (!shop || !pendingHandled.current) return
    const found = businesses.find(b => b.id === shop.id)
    if (found) { pendingJoin = null; setSelected(found) }
  }, [businesses])

  const favouriteBusinesses = businesses.filter((b) => favouriteIds.has(b.id))
  // Home and the map show shops in the shopper's country; shops they already
  // joined or saved stay reachable wherever they are.
  const localBusinesses = useMemo(
    () => businesses.filter((b) => (b.country_code ?? 'GB') === shopperCountry.country.code),
    [businesses, shopperCountry.country.code],
  )

  // Android back: close the shop page, else go back to Home. Only Home leaves back to the system
  // (HomeTab closes its own search first). Open sheets are Modals and handle back themselves.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selected) { closeShop(); return true }
      if (tab !== 'home') { setTab('home'); return true }
      return false
    })
    return () => sub.remove()
  }, [selected, tab])

  const celebration = (
      <RewardCelebration
        reward={celebrate}
        onUse={() => { if (celebrate) void markRewardsSeen([celebrate.id]); setCelebrate(null); setSelected(null); setTab('rewards') }}
        onLater={() => { if (celebrate) void markRewardsSeen([celebrate.id]); setCelebrate(null) }}
      />
  )

  // The shop page sits over the tabs instead of replacing them, so the list keeps its
  // place and Back can shrink the page into the exact card it grew from.
  const shopOverlay = selected && shopKey ? (
    <CardGrowOverlay
      key={shopKey}
      ref={shopPage}
      shopId={selected.id}
      pageColor={shopSkin(selected).bg}
      logoUrl={selected.logo_url}
      onClosed={() => { if (shopKeyRef.current === shopKey) setSelected(null) }}
    >
      <ShopDetail
        business={selected}
        programmeVersion={programmeVersion}
        seedCatalog={homeCatalog.length ? homeCatalog.filter((row) => row.business_id === selected.id && !row.kind) : null}
        openAtCode={codeShopId === selected.id}
        userId={userId}
        membership={memberships.find((m) => m.business_id === selected.id)}
        stampCode={stampCode}
        favourite={favouriteIds.has(selected.id)}
        onBack={closeShop}
        onToggleFavourite={() => toggleFavourite(selected)}
        refresh={load}
        onJoined={(m) => { setMemberships(prev => [...prev.filter(x => x.business_id !== m.business_id), { ...m, rolling_spend_pence: 0 }]); void afterJoin(selected.name) }}
        cardLinking={cardLinking}
        onLinkCard={() => void linkCardFromShop()}
      />
    </CardGrowOverlay>
  ) : null

  const discovering = tab === 'discover' && SHOW_DISCOVER_TAB
  const listLoad: ListLoad = { loading: loading && !everLoaded, failed: loadFailed && !everLoaded, onRetry: () => void load() }

  return (
    <View style={styles.safe}>
    <SafeAreaView
      style={styles.safe}
      edges={discovering ? ['bottom'] : ['top', 'bottom']}
      accessibilityElementsHidden={!!selected}
      importantForAccessibility={selected ? 'no-hide-descendants' : 'auto'}
    >
      <StatusBar barStyle={statusBarStyle(isDark, discovering)} />
      {!discovering && tab !== 'home' && tab !== 'map' && <AppHeader onOpenProfile={() => setShowProfile(true)} />}
      {!discovering && <OutageBanner status={serviceStatus} savedAt={savedAt} />}
      {!discovering && (
        <PlatformBanner
          notices={platformNotices}
          dismissedIds={dismissedNoticeIds}
          onDismiss={(id) => setDismissedNoticeIds((prev) => new Set(prev).add(id))}
        />
      )}
      {discovering ? (
        <DiscoverTab
          favouriteIds={favouriteIds}
          onToggleFavourite={toggleFavourite}
          onOpenShop={openShop}
          onBack={() => setTab('home')}
        />
      ) : tab === 'map' ? (
        <MapTab businesses={localBusinesses} onSelect={openShop} onAsk={(query,location) => setAskShop({query,location})} />
      ) : (
        <KeyboardAwareScrollView contentContainerStyle={styles.screen} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} {...whirlRefreshControlProps} />}>
          <WhirlRefreshIndicator refreshing={loading} />
          {tab === 'home' && <HomeTab userId={userId} firstName={session.user.user_metadata?.first_name} onOpenProfile={() => setShowProfile(true)} onSeeNews={() => setTab('news')} businesses={localBusinesses} memberships={memberships} catalog={homeCatalog} loading={loading} failed={loadFailed} onRetry={() => void load()} announcements={announcements} onSelect={openShop} onShowCard={showCard} onAsk={query => setAskShop({query})} />}
          {tab === 'news' && <NewsTab announcements={announcements} load={listLoad} />}
          {tab === 'rewards' && <RewardsTab rewards={rewards} load={listLoad} />}
          {tab === 'favourites' && (
            <FavouritesTab favourites={favouriteBusinesses} memberships={memberships} onSelect={openShop} onQuickJoin={quickJoin} load={listLoad} />
          )}
        </KeyboardAwareScrollView>
      )}
      {!discovering && <BottomTabBar tab={tab} onChange={setTab} />}
      {celebration}
      <AskShopSheet visible={askShop !== null} initialQuery={askShop?.query ?? ''} location={askShop?.location} onClose={() => setAskShop(null)} onViewShop={id => { const shop=businesses.find(b => b.id === id); if(shop)openShop(shop) }} />
      <SettingsSheet
        visible={showProfile}
        session={session}
        userId={userId}
        stampCode={stampCode}
        initialView={settingsView}
        cardLinking={cardLinking}
        country={shopperCountry}
        onLinkCard={() => void linkCardFromSettings()}
        onViewRequested={id=>{const shop=businesses.find(b=>b.id===id);if(shop){setShowProfile(false);openShop(shop)}}}
        onClose={() => {
          setShowProfile(false)
          setSettingsView('root')
        }}
      />
      {cardLinkedCheck}
      {pingSheet}
    </SafeAreaView>
    {shopOverlay}
    </View>
  )
}

// ---------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------

export default function App() {
  // Brand display font. Rendering does not wait for it: titles fall back to the
  // system font for a frame on first launch, then switch once loaded.
  useFonts({ ...CARD_FONTS, BricolageGrotesque_600SemiBold, BricolageGrotesque_700Bold, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold, InstrumentSerif_400Regular_Italic })
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppWhirlProvider>
            <AppRoot />
            <AppAlertHost />
            <AppIntro />
          </AppWhirlProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

/** Sign-out: forget every locally saved snapshot (launch cache and the home screen copy). */
async function clearAllLaunchData(userId: string | null) {
  clearLaunchCache()
  if (userId) clearHomeCache(userId)
}

function AppRoot() {
  const { isDark } = useTheme() // re-renders the whole app when the scheme changes
  const [session, setSession] = useState<Session | null>(null)
  const [checking, setChecking] = useState(true)
  // Verdict from the server this launch; until it arrives the last verified
  // verdict (saved on this phone, per user) is used so the app opens at once.
  const [verdict, setVerdict] = useState<{ uid: string; ok: boolean } | null>(null)
  const [auth, setAuth] = useState<{ mode: 'signIn' | 'signUp'; reason?: string } | null>(null)
  const [locked, setLocked] = useState(false)
  const [checkingLock, setCheckingLock] = useState(false)
  // The biometric check has run for this user (it is local, so it is quick).
  // Until then the app stays hidden so cached data never flashes before the lock.
  const [lockCheckedFor, setLockCheckedFor] = useState<string | null>(null)
  const checkingUpdate = useLaunchUpdate()
  const lastUserId = useRef<string | null>(null)
  const optimisticToken = useRef<string | null>(null)
  const uid = session?.user.id ?? null
  if (uid) lastUserId.current = uid

  useEffect(() => {
    let active = true
    // 1. Show the app from the stored session without waiting for the network.
    void readStoredSession().then((stored) => {
      if (!active || !stored) return
      optimisticToken.current = stored.access_token
      setSession((current) => current ?? stored)
      setChecking(false)
    })
    // 2. Confirm in the background. getSession() may refresh an expired token.
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (data.session) {
        optimisticToken.current = null
        setSession(data.session)
      } else if (!error || isSessionRejection(error)) {
        // Really signed out (or the server rejected it). Offline errors keep the stored session.
        setSession((current) => (!current || optimisticToken.current === current.access_token ? null : current))
        if (error) void clearAllLaunchData(lastUserId.current)
      }
      setChecking(false)
    })
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'SIGNED_OUT') {
        void clearAllLaunchData(lastUserId.current)
        setSession(null)
      } else if (next) {
        optimisticToken.current = null
        setSession(next)
      }
      // INITIAL_SESSION with no session is ignored: a failed offline refresh must not undo the stored session.
    })
    return () => { active = false; data.subscription.unsubscribe() }
  }, [])

  const cachedVerdict = useMemo(() => (uid ? readLaunchCache<{ ok: boolean }>('role', uid)?.data.ok === true : false), [uid])
  const allowed = uid ? (verdict?.uid === uid ? verdict.ok : cachedVerdict) : false

  useEffect(() => {
    if (!uid) return
    let active = true
    const ticket = launchCacheTicket()
    ;(async () => {
      await supabase.rpc('ensure_current_user_bootstrap')
      const { data, error } = await supabase.from('user_roles').select('role').eq('user_id', uid)
      if (!active) return
      if (error && isSessionRejection(error)) {
        // The server says this session is no good: sign out for real.
        await disableWalkPast().catch(() => undefined)
        await supabase.auth.signOut().catch(() => undefined)
        return
      }
      // Couldn't reach us (outage or no signal): keep them signed in and show
      // the saved home screen. Row-level security still guards every read.
      if (error || !data) { setVerdict({ uid, ok: true }); return }
      const ok = isShopper(data.map((row: any) => row.role))
      setVerdict({ uid, ok })
      if (ok) writeLaunchCache('role', uid, { ok: true }, ticket)
      else {
        showAlert('Use the business app', 'This account is an owner or staff account. Please sign in to The Loyalty Loop for Business instead.')
        await disableWalkPast().catch(() => undefined)
        await supabase.auth.signOut()
      }
    })()
    return () => { active = false }
  }, [uid])

  async function checkAppLock() {
    if (!session) { setLocked(false); return }
    const forUser = session.user.id
    try {
      const enabled = await biometricLockEnabled()
      if (!enabled) { setLocked(false); return }
      setCheckingLock(true)
      setLocked(true)
      const success = await unlockWithBiometrics()
      setLocked(!success)
      setCheckingLock(false)
    } finally {
      setLockCheckedFor(forUser)
    }
  }

  useEffect(() => { void checkAppLock() }, [session?.user.id])
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active' && session) void checkAppLock() })
    return () => subscription.remove()
  }, [session?.user.id])
  // Saves the token only if notifications are already allowed; the question itself comes after a first join.
  useEffect(() => { if (session) void registerPushToken(session.user.id).catch(() => undefined) }, [session?.user.id])
  // Android back on sign-in or sign-up returns to the shops, like the on-screen back arrow.
  const onAuthScreen = !session && auth !== null
  useEffect(() => {
    if (!onAuthScreen) return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { pendingJoin = null; setAuth(null); return true })
    return () => sub.remove()
  }, [onAuthScreen])

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
  if (checkingUpdate || checking || (session && (!allowed || checkingLock || lockCheckedFor !== session.user.id))) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={{ padding: 20 }}><SkeletonScreen cards={3} cardHeight={150} /></View>
      </SafeAreaView>
    )
  }
  if (session && locked) {
    return <SafeAreaView style={styles.safe}><View style={styles.lockScreen}><Image source={logo} style={styles.lockLogo} /><Text style={styles.title}>App locked</Text><Text style={styles.description}>Use Face ID, Touch ID or your fingerprint to continue.</Text><Button title="Unlock app" onPress={() => void checkAppLock()} /></View></SafeAreaView>
  }
  if (session) return <AppHome session={session} />
  if (auth) return <AuthScreen key={auth.mode + (auth.reason ?? '')} initialMode={auth.mode} reason={auth.reason} onSession={(next) => { setAuth(null); setSession(next) }} onBack={() => { pendingJoin = null; setAuth(null) }} />
  return <GuestHome
    onJoin={(shop) => { pendingJoin = shop; setAuth({ mode: 'signUp', reason: `One quick account and your ${shop.name} card is yours. We’ll join it for you the moment you’re in.` }) }}
    onSignUp={() => setAuth({ mode: 'signUp' })}
    onSignIn={() => setAuth({ mode: 'signIn' })}
  />
}

// ---------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------

const styles = themed(() => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  platformBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 12 },
  platformBannerText: { color: schemeColor('#fff', 'fg'), fontSize: 13, fontWeight: '700' },
  platformBannerBody: { fontWeight: '400', opacity: 0.9 },
  auth: { flexGrow: 1, padding: 28, justifyContent: 'center' },
  screen: { padding: 20, paddingBottom: 130 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pingSheet: { backgroundColor: schemeColor('#F4F1EA', 'bg'), borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 22, paddingTop: 12, paddingBottom: 16 },
  pingHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: schemeColor('rgba(0,0,0,0.15)', 'bg'), alignSelf: 'center', marginBottom: 20 },
  pingIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: schemeColor('#2B3A67', 'bg'), alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  pingTitle: { color: schemeColor('#1A2138', 'fg'), fontSize: 28, lineHeight: 32, fontFamily: 'Inter_800ExtraBold', letterSpacing: -0.6 },
  pingCopy: { color: schemeColor('#6F6B64', 'fg'), fontSize: 15, lineHeight: 21, marginTop: 10, marginBottom: 22, fontFamily: 'Inter_500Medium' },
  pingRow: { flexDirection: 'row', gap: 12 },
  pingButton: { flex: 1, borderRadius: 999, paddingVertical: 16, alignItems: 'center' },
  pingNotNow: { backgroundColor: schemeColor('#E7E2D8', 'bg') },
  pingNotNowText: { color: schemeColor('#1A2138', 'fg'), fontSize: 16, fontFamily: 'Inter_700Bold' },
  pingOn: { backgroundColor: schemeColor('#2B3A67', 'bg') },
  pingOnText: { color: schemeColor('#F4F1EA', 'fg'), fontSize: 16, fontFamily: 'Inter_700Bold' },
  onboarding: { flex: 1, padding: 28, justifyContent: 'center' },
  onboardingLogo: { width: 66, height: 66, resizeMode: 'contain', marginBottom: 44 },
  onboardingTitle: { color: colors.foreground, fontSize: 38, fontFamily: FONT_DISPLAY, lineHeight: 44, letterSpacing: -1.1 },
  onboardingDots: { flexDirection: 'row', gap: 8, marginTop: 36, marginBottom: 36 },
  onboardingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: schemeColor('#DCD6CB', 'bg') },
  onboardingDotActive: { width: 26, backgroundColor: colors.primary },
  onboardingConsent: { marginTop: 28 },
  onboardingSkip: { alignItems: 'center', padding: 16 },
  onboardingSkipText: { color: colors.primaryText, fontSize: 15, fontWeight: '700' },

  mark: { width: 64, height: 64, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: schemeColor('rgba(0,0,0,0.08)', 'border'), alignItems: 'center', justifyContent: 'center', marginBottom: 28, overflow: 'hidden' },
  markImage: { width: 46, height: 46, resizeMode: 'contain' },

  eyebrow: { color: colors.primaryText, fontWeight: '700', fontSize: 14, marginBottom: 12 },
  hero: { color: colors.foreground, fontSize: 36, fontFamily: FONT_DISPLAY, lineHeight: 42, letterSpacing: -1 },
  title: { color: colors.foreground, fontSize: 26, fontFamily: FONT_DISPLAY, lineHeight: 31, letterSpacing: -0.5 },
  copy: { color: schemeColor('#000000', 'fg'), fontSize: 16, lineHeight: 24, marginTop: 16 },
  description: { color: schemeColor('#000000', 'fg'), fontSize: 15, lineHeight: 22, marginTop: 8 },
  landingTitle: { color: colors.foreground, fontSize: 16, fontWeight: '800', marginTop: 3 },
  landingCopy: { color: schemeColor('#000000', 'fg'), fontSize: 13, lineHeight: 19, marginBottom: 8 },

  card: { backgroundColor: colors.card, borderRadius: 20, padding: 20, marginTop: 28, gap: 12, shadowColor: '#1A2138', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  input: { backgroundColor: schemeColor('#EFEBE3', 'bg'), borderRadius: 12, paddingHorizontal: 16, paddingVertical: 16, color: colors.foreground, fontSize: 16 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: schemeColor('#fff', 'bg'), borderRadius: 16, borderWidth: 1.5, borderColor: schemeColor('rgba(0,0,0,0.14)', 'border'), paddingHorizontal: 16, marginBottom: 12, shadowColor: '#7a4a22', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  searchBarFloating: { marginBottom: 0, borderRadius: 999, borderWidth: 0, paddingHorizontal: 20, shadowColor: '#1A2138', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  searchInput: { flex: 1, paddingVertical: 16, color: colors.foreground, fontSize: 16 },
  askShopCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20, padding: 16, borderRadius: 18, backgroundColor: schemeColor('#fde6d9', 'bg'), borderWidth: 1, borderColor: schemeColor('#f6c9ae', 'border') },
  askShopIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  askShopTitle: { fontSize: 15.5, fontWeight: '700', color: colors.foreground },
  askShopCopy: { color: schemeColor('#000000', 'fg'), fontSize: 12.5, marginTop: 2, lineHeight: 17 },
  appleButton: { width: '100%', height: 48, marginBottom: 12 },
  appleButtonAndroid: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: schemeColor('#000', 'bg'), borderRadius: 12 },
  appleButtonText: { color: schemeColor('#fff', 'fg'), fontWeight: '800', fontSize: 15 },
  googleButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: schemeColor('#fff', 'bg'), borderRadius: 12, borderWidth: 1.5, borderColor: schemeColor('rgba(0,0,0,0.12)', 'border'), paddingVertical: 16 },
  googleButtonText: { color: colors.foreground, fontWeight: '800', fontSize: 15 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: schemeColor('rgba(0,0,0,0.1)', 'bg') },
  dividerText: { color: schemeColor('#000000', 'fg'), fontSize: 12, fontWeight: '700' },

  button: { backgroundColor: colors.primary, borderRadius: 999, alignItems: 'center', padding: 16, marginTop: 2, borderWidth: 1, borderColor: schemeColor('rgba(255,255,255,0.72)', 'border'), shadowColor: colors.primary, shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  buttonSecondary: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.foreground, marginTop: 20 },
  buttonText: { color: schemeColor('#fff', 'fg'), fontWeight: '800', fontSize: 16 },
  buttonTextSecondary: { color: colors.foreground },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.6 },
  link: { color: colors.primaryText, textAlign: 'center', fontWeight: '700', marginTop: 8 },
  small: { color: schemeColor('#000000', 'fg'), fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 24 },
  authHelpLink: { alignSelf: 'center', marginTop: 16, paddingVertical: 8, paddingHorizontal: 12 },
  authHelpLinkText: { color: schemeColor('#000000', 'fg'), fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: schemeColor('rgba(0,0,0,0.06)', 'border') },
  headerBrand: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerLogo: { width: 32, height: 32, borderRadius: 8 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: colors.foreground },
  headerProfileButton: { width: 40, height: 40, aspectRatio: 1, flexShrink: 0, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: schemeColor('rgba(0,0,0,0.08)', 'border') },

  pageTitle: { fontSize: 26, fontFamily: FONT_DISPLAY, color: colors.foreground, letterSpacing: -0.5, marginBottom: 16, marginTop: 4 },

  // Category pills
  pillRow: { gap: 8, paddingBottom: 24 },
  pill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5, borderColor: schemeColor('rgba(0,0,0,0.1)', 'border'), backgroundColor: colors.card },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { fontSize: 13, fontWeight: '700', color: colors.foreground },
  pillTextActive: { color: schemeColor('#fff', 'fg') },

  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionEyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1, color: schemeColor('#000000', 'fg') },
  sparkle: { color: colors.primaryText, fontSize: 13 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: colors.foreground },

  // Announcements
  announcementRow: { gap: 12, paddingBottom: 28 },
  announcementCard: { width: 240, backgroundColor: colors.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: schemeColor('rgba(0,0,0,0.06)', 'border') },
  announcementBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: schemeColor('rgba(232,112,59,0.12)', 'bg'), alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  announcementFrom: { fontSize: 13, fontWeight: '600', color: schemeColor('#000000', 'fg') },
  announcementTitle: { fontSize: 15, fontWeight: '800', color: colors.foreground, marginTop: 4 },
  announcementBody: { fontSize: 13, color: schemeColor('#000000', 'fg'), marginTop: 4, lineHeight: 18 },

  // Trending grid
  trendingGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  trendingCard: { width: '47%', borderRadius: 18, backgroundColor: colors.card, overflow: 'hidden', borderWidth: 1, borderColor: schemeColor('rgba(0,0,0,0.06)', 'border') },
  trendingCover: { height: 90, width: '100%' },
  trendingContent: { padding: 12 },
  trendingName: { fontSize: 14, fontWeight: '800', color: colors.foreground },

  // Nearby list
  nearbyRow: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: colors.card, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 16, marginBottom: 12, borderWidth: 1, borderColor: schemeColor('rgba(0,0,0,0.06)', 'border') },
  nearbyLogo: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  logoLetter: { color: schemeColor('#fff', 'fg'), fontWeight: '800', fontSize: 17, lineHeight: 20, textAlign: 'center', includeFontPadding: false, textAlignVertical: 'center' },
  nearbyCategory: { color: schemeColor('#000000', 'fg'), fontSize: 13, fontWeight: '600', marginTop: 3 },
  nearbyAddress: { color: schemeColor('#000000', 'fg'), fontSize: 12, fontWeight: '400', marginTop: 2 },
  shopName: { fontSize: 16, fontWeight: '800', color: colors.foreground },
  muted: { color: schemeColor('#000000', 'fg'), fontSize: 12.5, lineHeight: 18, marginTop: 2 },
  empty: { color: schemeColor('#000000', 'fg'), fontSize: 15, lineHeight: 22, marginTop: 12 },

  // Map
  mapPage: { flex: 1, backgroundColor: colors.background },
  mapEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  mapTop: { position: 'absolute', top: 12, left: 16, right: 16 },
  mapResults: { marginTop: 8, maxHeight: 320, backgroundColor: schemeColor('#fff', 'bg'), borderRadius: 22, overflow: 'hidden', shadowColor: '#1A2138', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  mapResultRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 60 },
  mapResultDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: schemeColor('rgba(0,0,0,0.12)', 'border') },
  mapResultName: { fontSize: 15.5, fontWeight: '800', color: colors.foreground },
  mapResultMeta: { fontSize: 12.5, color: schemeColor('#55524C', 'fg'), marginTop: 2 },
  mapBottom: { position: 'absolute', left: 0, right: 0, bottom: MAP_CARDS_BOTTOM },
  mapLocate: { alignSelf: 'flex-end', marginRight: MAP_CARD_SIDE, marginBottom: 12, width: 48, height: 48, borderRadius: 24, backgroundColor: schemeColor('#fff', 'bg'), alignItems: 'center', justifyContent: 'center', shadowColor: '#1A2138', shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 6 },
  mapCards: { paddingHorizontal: MAP_CARD_SIDE, gap: MAP_CARD_GAP, paddingBottom: 14, paddingTop: 4 },
  mapCard: { width: MAP_CARD_WIDTH, flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: schemeColor('#fff', 'bg'), borderRadius: 24, padding: 14, shadowColor: '#1A2138', shadowOpacity: 0.2, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 7 },
  mapCardPressed: { transform: [{ scale: 0.98 }] },
  mapCardMeta: { color: schemeColor('#55524C', 'fg'), fontSize: 12.5, fontWeight: '600', marginTop: 3 },
  mapCardMiles: { color: colors.foreground, fontWeight: '800' },
  mapPlaceholderText: { textAlign: 'center', color: schemeColor('#000000', 'fg'), fontSize: 13.5, lineHeight: 19 },

  // News
  newsCard: { backgroundColor: colors.card, borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: schemeColor('rgba(0,0,0,0.06)', 'border') },
  newsTitle: { fontSize: 16, fontWeight: '800', color: colors.foreground, marginTop: 4 },
  newsDate: { color: schemeColor('#000000', 'fg'), fontSize: 11, marginTop: 8 },

  // Shop detail
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 20 },
  back: { color: colors.foreground, fontWeight: '700', fontSize: 15 },
  detailCover: { height: 190, width: '100%', borderRadius: 22, overflow: 'hidden', marginBottom: 20 },
  favouriteButton: { position: 'absolute', top: 14, right: 14, width: 38, height: 38, borderRadius: 19, backgroundColor: schemeColor('rgba(255,255,255,0.92)', 'bg'), alignItems: 'center', justifyContent: 'center' },

  joinCard: { backgroundColor: colors.card, borderRadius: 22, padding: 28, marginTop: 20, alignItems: 'center' },
  joinTitle: { fontSize: 19, fontWeight: '800', color: colors.foreground, textAlign: 'center', marginBottom: 12 },
  rewardPill: { backgroundColor: schemeColor('rgba(0,0,0,0.06)', 'bg'), borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 12 },
  rewardPillText: { fontSize: 11, fontWeight: '700', color: schemeColor('#000000', 'fg') },
  rewardTitleLarge: { fontSize: 19, fontWeight: '800', color: colors.foreground, textAlign: 'center' },
  rewardTierList: { alignSelf: 'stretch', gap: 8, marginTop: 2 },
  rewardTier: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: schemeColor('#EFEBE3', 'bg'), borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 },
  rewardTierThreshold: { color: colors.foreground, fontSize: 13, fontWeight: '800' },
  rewardTierTitle: { color: colors.foreground, fontSize: 15, fontWeight: '700', flex: 1, textAlign: 'right', marginLeft: 16 },

  designedCardWrap: { marginTop: 20 },
  loyaltyCard: { backgroundColor: colors.card, borderRadius: 22, padding: 20, marginTop: 20, borderWidth: 1, borderColor: schemeColor('rgba(0,0,0,0.06)', 'border') },
  loyaltyCardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  loyaltyCardCount: { fontSize: 16, fontWeight: '700', letterSpacing: -0.3, color: schemeColor('#000000', 'fg'), fontVariant: ['tabular-nums'] },
  bar: { height: 9, borderRadius: 6, backgroundColor: schemeColor('rgba(0,0,0,0.07)', 'bg'), overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 6 },
  qrWrap: { alignItems: 'center', marginTop: 20 },
  qrText: { color: schemeColor('#000000', 'fg'), fontWeight: '600', fontSize: 12.5, marginTop: 12 },
  manualCodeLabel: { color: schemeColor('#000000', 'fg'), fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 16 },
  manualCode: { color: colors.foreground, fontSize: 20, fontWeight: '900', letterSpacing: 3, textAlign: 'center', marginTop: 4 },
  securityCard: { backgroundColor: schemeColor('#EFEBE3', 'bg'), borderRadius: 18, padding: 16, marginTop: 16, borderWidth: 1, borderColor: schemeColor('rgba(0,0,0,0.07)', 'border') },
  securityCopy: { color: schemeColor('#000000', 'fg'), fontSize: 13, lineHeight: 19, marginTop: 4 },
  securityButton: { alignSelf: 'flex-start', marginTop: 12, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: schemeColor('rgba(79,100,56,0.12)', 'bg') },
  securityButtonText: { color: colors.primaryText, fontSize: 13, fontWeight: '800' },
  lockScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28 },
  lockLogo: { width: 72, height: 72, borderRadius: 20, marginBottom: 24 },
  walletButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: schemeColor('#1A2138', 'bg'), borderRadius: 999, height: 46, marginTop: 20 },
  walletButtonText: { color: schemeColor('#fff', 'fg'), fontWeight: '700', fontSize: 14 },

  // Visit and contact details
  visitSection: { marginTop: 28 },
  mapEmbed: { height: 150, marginTop: 12, overflow: 'hidden', borderRadius: 18, borderWidth: 1, borderColor: schemeColor('rgba(0,0,0,0.08)', 'border'), backgroundColor: schemeColor('#E7EAE2', 'bg') },
  nativeMap: { flex: 1 },
  shopNotifyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: schemeColor('rgba(0,0,0,0.12)', 'border') },
  shopNotifyTitle: { fontSize: 14, fontWeight: '700', color: colors.foreground },
  shopNotifyCopy: { color: schemeColor('#000000', 'fg'), fontSize: 12, marginTop: 1, lineHeight: 16 },
  settingsSheet: { paddingHorizontal: 20, maxHeight: '80%' },
  settingsSheetScroll: { paddingBottom: 20, gap: 20 },
  sheetBack: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  settingsHero: { borderRadius: 24, padding: 16, gap: 16, shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  settingsHeroRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  settingsHeroAvatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: schemeColor('rgba(255,255,255,0.22)', 'bg'), borderWidth: 2, borderColor: schemeColor('rgba(255,255,255,0.75)', 'border'), alignItems: 'center', justifyContent: 'center' },
  settingsHeroAvatarText: { color: schemeColor('#fff', 'fg'), fontFamily: FONT_DISPLAY, fontSize: 20 },
  settingsHeroName: { color: schemeColor('#fff', 'fg'), fontSize: 20, fontFamily: FONT_DISPLAY },
  settingsHeroEmail: { color: schemeColor('rgba(255,255,255,0.85)', 'fg'), fontSize: 13, marginTop: 2 },
  settingsHeroButton: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: schemeColor('#fff', 'bg'), borderRadius: 16, paddingHorizontal: 12, paddingVertical: 12 },
  settingsHeroButtonIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  settingsHeroButtonTitle: { color: colors.foreground, fontWeight: '800', fontSize: 15 },
  settingsHeroButtonCopy: { color: schemeColor('#000000', 'fg'), fontSize: 12.5, marginTop: 1 },
  settingsGroup: { gap: 8 },
  settingsGroupTitle: { fontSize: 14, fontWeight: '600', color: schemeColor('#000000', 'fg'), marginLeft: 8 },
  settingsCard: { backgroundColor: colors.card, borderRadius: 18, overflow: 'hidden' },
  settingsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, minHeight: 56 },
  settingsRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: schemeColor('rgba(0,0,0,0.12)', 'border') },
  settingsRowPressed: { backgroundColor: schemeColor('rgba(0,0,0,0.04)', 'bg') },
  settingsIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  settingsRowBody: { flex: 1 },
  settingsRowTitle: { fontSize: 15.5, fontWeight: '700', color: colors.foreground },
  settingsRowTitleDanger: { color: schemeColor('#b54439', 'fg') },
  settingsRowDetail: { color: schemeColor('#000000', 'fg'), fontSize: 12.5, marginTop: 2, lineHeight: 17 },
  settingsFooter: { textAlign: 'center', color: schemeColor('#000000', 'fg'), fontSize: 12, marginTop: 4 },
  settingsFieldLabel: { fontSize: 14, fontWeight: '600', color: schemeColor('#000000', 'fg'), paddingHorizontal: 16, paddingTop: 16 },
  settingsInput: { fontSize: 17, color: colors.foreground, paddingHorizontal: 16, paddingVertical: 12 },
  settingsFieldHelp: { color: schemeColor('#000000', 'fg'), fontSize: 12.5, paddingHorizontal: 16, paddingBottom: 16, lineHeight: 17 },
  settingsEmpty: { color: schemeColor('#000000', 'fg'), fontSize: 14, lineHeight: 20, padding: 16 },
  cardScreen: { backgroundColor: colors.card, borderRadius: 24, padding: 24, alignItems: 'center' },
  // Fixed white in both schemes: scanners need a light margin of about four modules round the code.
  cardQr: { backgroundColor: '#FFFFFF', padding: 26, borderRadius: 20 },
  cardName: { fontSize: 20, fontFamily: FONT_DISPLAY, color: colors.foreground, marginTop: 20 },
  pinWrap: { alignItems: 'center', width: 60, height: 66, paddingTop: 8 },
  pinHalo: { position: 'absolute', top: 0, width: 56, height: 56, borderRadius: 28, opacity: 0.22 },
  pinBody: { width: 44, height: 44, borderRadius: 22, borderWidth: 3, borderColor: schemeColor('#fff', 'border'), alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  pinInner: { width: 32, height: 32, borderRadius: 16, backgroundColor: schemeColor('#fff', 'bg'), overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  pinLogo: { width: 32, height: 32 },
  pinInitial: { fontWeight: '900', fontSize: 14, letterSpacing: -0.5 },
  pinTail: { width: 0, height: 0, borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 11, borderLeftColor: 'transparent', borderRightColor: 'transparent', marginTop: -4 },
  pinShadow: { width: 16, height: 5, borderRadius: 8, backgroundColor: schemeColor('rgba(0,0,0,0.2)', 'bg'), marginTop: 1 },
  mapAddress: { color: schemeColor('#000000', 'fg'), fontSize: 13, lineHeight: 19, marginTop: 8 },
  directionsButton: { alignSelf: 'flex-start', marginTop: 12, borderRadius: 999, backgroundColor: schemeColor('rgba(79,100,56,0.12)', 'bg'), paddingHorizontal: 16, paddingVertical: 12 },
  directionsButtonText: { color: colors.primaryText, fontSize: 13, fontWeight: '800' },
  contactList: { marginTop: 12, borderWidth: 1, borderColor: schemeColor('rgba(0,0,0,0.08)', 'border'), borderRadius: 18, overflow: 'hidden', backgroundColor: colors.card },
  contactRow: { minHeight: 54, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, borderBottomWidth: 1, borderBottomColor: schemeColor('rgba(0,0,0,0.07)', 'border') },
  contactLabel: { color: colors.foreground, fontSize: 14, fontWeight: '800', flexShrink: 0 },
  contactValue: { color: colors.primaryText, fontSize: 13, fontWeight: '700', flex: 1, textAlign: 'right' },

  // Shop gallery — a tall, photo-first scrolling feed.
  gallerySection: { marginTop: 32 },
  galleryHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  gallerySubheading: { color: schemeColor('#000000', 'fg'), fontSize: 12.5, marginTop: 3 },
  galleryCount: { color: colors.primaryText, fontSize: 12, fontWeight: '800' },
  shortsFeed: { gap: 16, marginTop: 12 },
  shortCard: { height: 430, borderRadius: 22, overflow: 'hidden', backgroundColor: schemeColor('#DFE3DA', 'bg'), position: 'relative' },
  shortImage: { width: '100%', height: '100%' },
  shortOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: 94, paddingHorizontal: 16, paddingVertical: 16, justifyContent: 'flex-end', backgroundColor: schemeColor('rgba(20,20,18,0.42)', 'bg') },
  shortIndex: { color: schemeColor('rgba(255,255,255,0.8)', 'fg'), fontSize: 12, fontWeight: '600' },
  shortShopName: { color: schemeColor('#fff', 'fg'), fontSize: 18, fontWeight: '900', marginTop: 4 },

  // Reviews
  reviewsSection: { marginTop: 32 },
  reviewHint: { color: schemeColor('#000000', 'fg'), fontSize: 13.5, lineHeight: 20, marginTop: 8 },
  reviewComposer: { backgroundColor: colors.card, borderRadius: 18, padding: 16, marginTop: 12, borderWidth: 1, borderColor: schemeColor('rgba(0,0,0,0.07)', 'border') },
  reviewComposerTitle: { fontSize: 15, fontWeight: '800', color: colors.foreground },
  starRow: { flexDirection: 'row', gap: 4, marginTop: 8 },
  starButton: { paddingVertical: 3, paddingRight: 3 },
  star: { fontSize: 29, lineHeight: 34, color: schemeColor('#000000', 'fg') },
  starSelected: { color: colors.accent },
  reviewInput: { minHeight: 92, marginTop: 12, borderRadius: 12, borderWidth: 1, borderColor: schemeColor('rgba(0,0,0,0.12)', 'border'), backgroundColor: schemeColor('#fff', 'bg'), color: colors.foreground, fontSize: 14, lineHeight: 20, paddingHorizontal: 12, paddingVertical: 12, textAlignVertical: 'top' },
  deleteReview: { color: schemeColor('#b54439', 'fg'), fontWeight: '800', fontSize: 13, textAlign: 'center', marginTop: 16 },
  reviewList: { marginTop: 20, gap: 16 },
  reviewItem: { borderTopWidth: 1, borderTopColor: schemeColor('rgba(0,0,0,0.09)', 'border'), paddingTop: 16 },
  reviewHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  reviewAuthor: { fontSize: 14, fontWeight: '800', color: colors.foreground },
  reviewDate: { color: schemeColor('#000000', 'fg'), fontSize: 11.5 },
  reviewStars: { color: colors.accent, fontSize: 17, letterSpacing: 1, marginTop: 4 },
  reviewBody: { color: schemeColor('#000000', 'fg'), fontSize: 13.5, lineHeight: 20, marginTop: 8 },
  reviewReply: { marginTop: 12, marginLeft: 8, paddingLeft: 12, borderLeftWidth: 3 },
  reviewReplyTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  reviewModRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  reviewModButton: { minHeight: 44, justifyContent: 'center' },
  reviewModLink: { color: schemeColor('#000000', 'fg'), fontSize: 12, fontWeight: '600' },
  reviewModDot: { color: schemeColor('#000000', 'fg'), fontSize: 12 },
  blockRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  blockRowText: { color: schemeColor('#000000', 'fg'), fontSize: 13 },
  blockRowUnblock: { color: colors.primaryText, fontSize: 13, fontWeight: '700' },
  spendHint: { color: schemeColor('#000000', 'fg'), fontSize: 12.5, lineHeight: 17, marginTop: 8 },
  cardsExplainer: { backgroundColor: schemeColor('#e0f2e4', 'bg'), borderRadius: 18, padding: 16, gap: 4 },
  cardsExplainerTitle: { fontSize: 15, fontWeight: '800', color: schemeColor('#1f5c33', 'fg'), marginBottom: 2 },
  cardsExplainerLine: { fontSize: 13.5, color: schemeColor('#2f5a3b', 'fg'), lineHeight: 19 },
  cardsHelp: { color: schemeColor('#000000', 'fg'), fontSize: 12.5, lineHeight: 17, textAlign: 'center', paddingHorizontal: 8 },
  autoEarnCard: { backgroundColor: schemeColor('#fdeccd', 'bg'), borderRadius: 18, padding: 16, marginTop: 16, gap: 8 },
  autoEarnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  autoEarnTitle: { fontSize: 15, fontWeight: '800', color: schemeColor('#7a4a0c', 'fg') },
  autoEarnCopy: { fontSize: 13.5, color: schemeColor('#6b4a1c', 'fg'), lineHeight: 19 },
  autoEarnChip: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: schemeColor('#fdeccd', 'bg'), borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, marginTop: 12 },
  autoEarnChipText: { fontSize: 12.5, fontWeight: '700', color: schemeColor('#7a4a0c', 'fg') },

  // Rewards

  // Favourites
  favouriteCard: { backgroundColor: colors.card, borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: schemeColor('rgba(0,0,0,0.06)', 'border') },
  favouriteTopRow: { marginBottom: 12 },
  favouriteLogo: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  categoryLabel: { fontSize: 13, fontWeight: '600', color: schemeColor('#000000', 'fg'), marginTop: 4 },
  favouriteDivider: { height: 1, backgroundColor: schemeColor('rgba(0,0,0,0.07)', 'bg'), marginVertical: 16 },
  favouriteBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  favouriteTapRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  favouriteDot: { width: 10, height: 10, borderRadius: 5 },
  favouriteStatus: { fontSize: 13.5, fontWeight: '700', color: colors.foreground },
  favouriteViewRow: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingLeft: 12 },
  favouriteViewText: { color: colors.primaryText, fontWeight: '800', fontSize: 13.5 },

  // Profile sheet
  sheetBackdrop: { flex: 1, backgroundColor: schemeColor('rgba(0,0,0,0.4)', 'bg') },
  sheet: { backgroundColor: colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24, maxHeight: '90%' },
  sheetScroll: { paddingBottom: 16 },
  deleteAccount: { color: schemeColor('#b54439', 'fg'), fontWeight: '800', fontSize: 13, textAlign: 'center', marginTop: 16 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: schemeColor('rgba(0,0,0,0.15)', 'bg'), alignSelf: 'center', marginBottom: 16 },
  sheetHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: schemeColor('#000000', 'fg') },

  // Bottom tab bar
  tabs: { position: 'absolute', left: 16, right: 16, bottom: 10, height: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.olive, borderRadius: 999, paddingHorizontal: 8, shadowColor: '#000000', shadowOpacity: 0.28, shadowRadius: 20, shadowOffset: { width: 0, height: 12 }, elevation: 12 },
  tab: { height: 52, minWidth: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, paddingHorizontal: 12 },
  tabActive: { backgroundColor: '#F4F1EA', paddingHorizontal: 16 },
  tabTextActive: { color: '#1A2138', fontFamily: 'Inter_500Medium', fontSize: 14 },

  // Discover feed
  discoverGradient: { ...StyleSheet.absoluteFillObject },
  discoverActionRail: { position: 'absolute', right: 14, bottom: 110, alignItems: 'center', gap: 24 },
  discoverActionButton: { alignItems: 'center', justifyContent: 'center' },
  discoverInfo: { position: 'absolute', left: 18, right: 80, bottom: 34 },
  discoverShopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  discoverLogo: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: schemeColor('rgba(255,255,255,0.8)', 'border') },
  discoverShopName: { color: schemeColor('#fff', 'fg'), fontWeight: '800', fontSize: 15, flexShrink: 1 },
  discoverTime: { color: schemeColor('rgba(255,255,255,0.75)', 'fg'), fontSize: 12, fontWeight: '600' },
  discoverCaption: { color: schemeColor('#fff', 'fg'), fontSize: 13.5, lineHeight: 19, marginTop: 8 },
  discoverViewShop: { color: schemeColor('#fff', 'fg'), fontWeight: '800', fontSize: 13, marginTop: 12 },
  discoverBack: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: schemeColor('rgba(0,0,0,0.35)', 'bg'),
  },
  discoverEmpty: { alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.background, paddingHorizontal: 40 },
  discoverEmptyText: { color: schemeColor('#000000', 'fg'), fontSize: 14, textAlign: 'center' },
}))
