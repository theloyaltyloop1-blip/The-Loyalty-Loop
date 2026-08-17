import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { supabase } from './supabase'

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) })

export async function registerPushToken(userId: string) {
  if (Platform.OS === 'web' || !Device.isDevice) return { registered: false, reason: 'physical device required' }
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('default', { name: 'Business updates', importance: Notifications.AndroidImportance.DEFAULT, vibrationPattern: [0, 250, 250, 250] })
  const current = await Notifications.getPermissionsAsync()
  const permission = current.granted ? current : await Notifications.requestPermissionsAsync()
  if (!permission.granted) return { registered: false, reason: 'permission denied' }
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId
  if (!projectId) return { registered: false, reason: 'missing EAS project ID' }
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data
  const { error } = await supabase.from('push_tokens').upsert({ token, user_id: userId, platform: Platform.OS, updated_at: new Date().toISOString() }, { onConflict: 'token' })
  if (error) throw error
  return { registered: true }
}
