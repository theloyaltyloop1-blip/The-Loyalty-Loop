import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { supabase } from './supabase'
import { showAlert } from './components/AppAlert'

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) })

/** Saves this phone's push token. Never shows the system question unless
 * `ask` is set: permission is asked for when a ping would help, not on launch. */
export async function registerPushToken(userId: string, { ask = false }: { ask?: boolean } = {}) {
  if (Platform.OS === 'web' || !Device.isDevice) return { registered: false, reason: 'physical device required' }
  const current = await Notifications.getPermissionsAsync()
  if (!current.granted && !ask) return { registered: false, reason: 'not asked yet' }
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('default', { name: 'Business updates', importance: Notifications.AndroidImportance.DEFAULT, vibrationPattern: [0, 250, 250, 250] })
  const permission = current.granted ? current : await Notifications.requestPermissionsAsync()
  if (!permission.granted) return { registered: false, reason: 'permission denied' }
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId
  if (!projectId) return { registered: false, reason: 'missing EAS project ID' }
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data
  const { error } = await supabase.from('push_tokens').upsert({ token, user_id: userId, platform: Platform.OS, updated_at: new Date().toISOString() }, { onConflict: 'token' })
  if (error) throw error
  return { registered: true }
}

const ASKED_KEY = 'loyalty-loop-business-push-prompt-asked'

/** Asks once, in our own pop-up with a "Not now" button, a few seconds after
 * sign-in, before the system notification prompt ever appears. Skipped if
 * notifications are already allowed, declined at system level, or we asked before. */
export async function offerPushPrompt(userId: string) {
  try {
    if (Platform.OS === 'web' || !Device.isDevice) return
    const current = await Notifications.getPermissionsAsync()
    if (current.granted || !current.canAskAgain) return
    if ((await SecureStore.getItemAsync(ASKED_KEY)) === 'yes') return
    await SecureStore.setItemAsync(ASKED_KEY, 'yes')
    setTimeout(() => showAlert('Want a nudge when something happens in your shop?', 'We’ll tell you when customers join and when a reward is claimed. Nothing else. You can change this any time in your phone’s settings.', [
      { text: 'Not now', style: 'cancel' },
      { text: 'Turn on', onPress: () => void registerPushToken(userId, { ask: true }).catch(() => undefined) },
    ]), 4000)
  } catch { /* never block the app on this */ }
}
