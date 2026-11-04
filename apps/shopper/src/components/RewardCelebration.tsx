import { useEffect, useRef } from 'react'
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { NIGHT, PAPER, SANS_HEAVY, SANS_MEDIUM, SAPPHIRE, STONE } from './Poster'

// Full-screen "Reward unlocked" moment, shown once per new reward.
// Seen reward ids live in SecureStore; the first run only records what's
// already there, so nobody gets a pile of old celebrations after an update.
const SEEN_KEY = 'celebrated_reward_ids'
const KEEP = 40

export async function unseenReward<T extends { id: string; redeemed_at?: string | null }>(rewards: T[]): Promise<T | null> {
  const open = rewards.filter(r => !r.redeemed_at)
  let raw: string | null = null
  try { raw = await SecureStore.getItemAsync(SEEN_KEY) } catch { return null }
  if (raw === null) {
    await markRewardsSeen(open.map(r => r.id))
    return null
  }
  let seen: string[] = []
  try { seen = JSON.parse(raw) } catch { seen = [] }
  return open.find(r => !seen.includes(r.id)) ?? null
}

export async function markRewardsSeen(ids: string[]) {
  try {
    const raw = await SecureStore.getItemAsync(SEEN_KEY)
    const seen: string[] = raw ? JSON.parse(raw) : []
    const next = [...seen.filter(id => !ids.includes(id)), ...ids].slice(-KEEP)
    await SecureStore.setItemAsync(SEEN_KEY, JSON.stringify(next))
  } catch {
    // Nothing to do: at worst the celebration shows again next time.
  }
}

const EASE = Easing.bezier(0.22, 1, 0.36, 1)

// Fixed positions so it looks composed rather than random.
const PIECES = [
  { left: '72%', top: '9%', width: 10, height: 10, borderRadius: 5, backgroundColor: PAPER, alpha: 0.7, rot: '0deg' },
  { left: '84%', top: '18%', width: 16, height: 5, borderRadius: 2, backgroundColor: SAPPHIRE, alpha: 1, rot: '-30deg' },
  { left: '58%', top: '27%', width: 14, height: 5, borderRadius: 2, backgroundColor: STONE, alpha: 0.6, rot: '24deg' },
  { left: '90%', top: '36%', width: 8, height: 8, borderRadius: 4, backgroundColor: SAPPHIRE, alpha: 1, rot: '0deg' },
  { left: '66%', top: '44%', width: 16, height: 5, borderRadius: 2, backgroundColor: PAPER, alpha: 0.5, rot: '-50deg' },
  { left: '12%', top: '6%', width: 12, height: 4, borderRadius: 2, backgroundColor: STONE, alpha: 0.45, rot: '40deg' },
] as const

// Near-black, the reward huge and heavy, a few quiet paper and sapphire pieces
// drifting down, and a thin ring drawing in behind.
export function RewardCelebration({ reward, onUse, onLater }: {
  reward: { title: string; business?: { name: string } | null } | null
  onUse: () => void
  onLater: () => void
}) {
  const ring = useRef(new Animated.Value(0)).current
  const text = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (!reward) return
    ring.setValue(0)
    text.setValue(0)
    Animated.sequence([
      Animated.timing(ring, { toValue: 1, duration: 900, easing: EASE, useNativeDriver: true }),
      Animated.timing(text, { toValue: 1, duration: 900, easing: EASE, useNativeDriver: true }),
    ]).start()
  }, [reward, ring, text])
  if (!reward) return null
  const title = reward.title.trim().replace(/[.!]+$/, '')
  const rise = (v: Animated.Value) => ({ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] })
  return (
    <Modal visible animationType="fade" statusBarTranslucent onRequestClose={onLater}>
      <View style={s.screen}>
        <Animated.View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[s.ring, { opacity: ring, transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] }]} />
        {PIECES.map((p, i) => <Animated.View key={i} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[s.piece, p, { opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0, p.alpha] }), transform: [{ rotate: p.rot }, { translateY: ring.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] }) }] }]} />)}
        <Animated.View style={[s.badge, rise(ring)]}><Text style={s.label}>Reward unlocked</Text></Animated.View>
        <Animated.Text accessibilityRole="header" style={[s.title, rise(text)]} numberOfLines={4} adjustsFontSizeToFit>{title}.</Animated.Text>
        {reward.business?.name ? <Animated.Text style={[s.copy, rise(text)]}>From {reward.business.name}. This one’s on them.</Animated.Text> : null}
        <View style={s.actions}>
          <Pressable accessibilityRole="button" onPress={onUse} style={({ pressed }) => [s.primary, pressed && s.pressed]}><Text style={s.primaryText}>Use it now</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={onLater} style={({ pressed }) => [s.secondary, pressed && s.pressed]}><Text style={s.secondaryText}>Save it for later</Text></Pressable>
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: NIGHT, paddingHorizontal: 24, paddingTop: 96, paddingBottom: 40, overflow: 'hidden' },
  ring: { position: 'absolute', right: -90, top: 70, width: 320, height: 320, borderRadius: 160, borderWidth: 1, borderColor: 'rgba(244,241,234,0.22)' },
  piece: { position: 'absolute' },
  badge: { alignSelf: 'flex-start', height: 32, paddingHorizontal: 14, borderRadius: 999, backgroundColor: PAPER, justifyContent: 'center' },
  label: { color: NIGHT, fontSize: 11, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase' },
  title: { marginTop: 30, color: PAPER, fontFamily: SANS_HEAVY, fontSize: 88, lineHeight: 84, letterSpacing: -5.5 },
  copy: { marginTop: 22, color: 'rgba(244,241,234,0.65)', fontSize: 17, lineHeight: 25, maxWidth: 320 },
  actions: { marginTop: 'auto', gap: 8 },
  primary: { height: 58, borderRadius: 999, backgroundColor: PAPER, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: NIGHT, fontFamily: SANS_MEDIUM, fontSize: 16 },
  secondary: { height: 52, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: PAPER, fontFamily: SANS_MEDIUM, fontSize: 15, opacity: 0.8 },
  pressed: { opacity: 0.8 },
})
