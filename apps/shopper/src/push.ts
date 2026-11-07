import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { supabase } from './supabase'

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) })

/** Whether the app may still ask for notifications. Web and simulators say 'unavailable'. */
export async function pushPermission(): Promise<'granted' | 'undetermined' | 'denied' | 'unavailable'> {
  if (Platform.OS === 'web' || !Device.isDevice) return 'unavailable'
  try {
    const current = await Notifications.getPermissionsAsync()
    if (current.granted) return 'granted'
    return current.canAskAgain ? 'undetermined' : 'denied'
  } catch { return 'unavailable' }
}

/** Saves this phone's push token. Only shows the system prompt when `ask` is
 * true, so the app asks at a moment it helps (after joining a card), never on launch. */
export async function registerPushToken(userId: string, { ask = false }: { ask?: boolean } = {}) {
  if (Platform.OS === 'web' || !Device.isDevice) return { registered: false, reason: 'physical device required' }
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('default', { name: 'Loyalty updates', importance: Notifications.AndroidImportance.DEFAULT, vibrationPattern: [0, 250, 250, 250] })
  const current = await Notifications.getPermissionsAsync()
  if (!current.granted && !ask) return { registered: false, reason: 'not asked yet' }
  const permission = current.granted ? current : await Notifications.requestPermissionsAsync()
  if (!permission.granted) return { registered: false, reason: 'permission denied' }
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId
  if (!projectId) return { registered: false, reason: 'missing EAS project ID' }
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data
  const { error } = await supabase.from('push_tokens').upsert({ token, user_id: userId, platform: Platform.OS, updated_at: new Date().toISOString() }, { onConflict: 'token' })
  if (error) throw error
  return { registered: true }
}
