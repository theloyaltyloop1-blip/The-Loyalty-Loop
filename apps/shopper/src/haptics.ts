import { Platform, Vibration } from 'react-native'
import * as Haptics from 'expo-haptics'
import * as SecureStore from 'expo-secure-store'

// Shared haptic patterns. Every call is wrapped so it can never crash, and respects the
// Settings "Haptics" switch (stored locally, default on).
const KEY = 'haptics_enabled'
let enabled = true
let loaded = false

async function load() {
  if (loaded) return
  loaded = true
  try { enabled = (await SecureStore.getItemAsync(KEY)) !== 'no' } catch { /* keep default on */ }
}
void load()

export async function getHapticsEnabled(): Promise<boolean> {
  loaded = false
  await load()
  return enabled
}
export async function setHapticsEnabled(on: boolean): Promise<void> {
  enabled = on
  loaded = true
  try { await SecureStore.setItemAsync(KEY, on ? 'yes' : 'no') } catch { /* ignore */ }
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const run = (fn: () => Promise<unknown>) => { if (!enabled) return; try { void fn().catch(() => undefined) } catch { /* never crash */ } }
const impact = (s: Haptics.ImpactFeedbackStyle) => Haptics.impactAsync(s)
const notify = (t: Haptics.NotificationFeedbackType) => Haptics.notificationAsync(t)

async function burst(count: number, gap: number, style: Haptics.ImpactFeedbackStyle) {
  for (let i = 0; i < count; i++) { await impact(style); await wait(gap) }
}

export const haptic = {
  /** Button presses that matter. */
  /** Very light repeating tick (hold-to-confirm fills). */
  tick: () => run(() => Haptics.selectionAsync()),
  tap: () => run(() => impact(Haptics.ImpactFeedbackStyle.Medium)),
  /** Picking / toggling something (favourite, choice). */
  select: () => run(() => impact(Haptics.ImpactFeedbackStyle.Heavy)),
  success: () => run(async () => { await notify(Haptics.NotificationFeedbackType.Success); await impact(Haptics.ImpactFeedbackStyle.Heavy) }),
  warning: () => run(() => notify(Haptics.NotificationFeedbackType.Warning)),
  error: () => run(async () => { await notify(Haptics.NotificationFeedbackType.Error); await impact(Haptics.ImpactFeedbackStyle.Heavy) }),
  /** Reward earned / redeemed. */
  reward: () => run(async () => {
    if (Platform.OS === 'android') { try { Vibration.vibrate([0, 80, 60, 80, 60, 160]) } catch { /* ignore */ } }
    await burst(3, 90, Haptics.ImpactFeedbackStyle.Heavy)
    await notify(Haptics.NotificationFeedbackType.Success)
  }),
  /** Card or stamp completed: longer, bigger. */
  celebrate: () => run(async () => {
    if (Platform.OS === 'android') { try { Vibration.vibrate([0, 80, 60, 80, 60, 160]) } catch { /* ignore */ } }
    await burst(4, 80, Haptics.ImpactFeedbackStyle.Rigid)
    await impact(Haptics.ImpactFeedbackStyle.Heavy)
    await wait(100)
    await notify(Haptics.NotificationFeedbackType.Success)
  }),
}
