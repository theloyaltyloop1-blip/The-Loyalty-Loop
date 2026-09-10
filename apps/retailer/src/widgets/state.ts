import { Platform } from 'react-native'
import Storage from 'expo-sqlite/kv-store'
import { ExtensionStorage } from '@bacons/apple-targets'

export const RETAILER_WIDGET_NAME = 'RetailerScanWidget'
export const RETAILER_WIDGET_STORAGE_KEY = 'loyalty-loop:retailer-widget'
const IOS_APP_GROUP = 'group.com.theloyaltyloop.retailer'

export type RetailerWidgetState = {
  businessName: string
  todayActions: number
  members: number
  updatedAt: string
}

export async function readRetailerWidgetState(): Promise<RetailerWidgetState | null> {
  const raw = await Storage.getItem(RETAILER_WIDGET_STORAGE_KEY)
  if (!raw) return null
  try { return JSON.parse(raw) as RetailerWidgetState } catch { return null }
}

export async function syncRetailerWidget(state: RetailerWidgetState) {
  await Storage.setItem(RETAILER_WIDGET_STORAGE_KEY, JSON.stringify(state))
  if (Platform.OS === 'ios') {
    const storage = new ExtensionStorage(IOS_APP_GROUP)
    storage.set(RETAILER_WIDGET_STORAGE_KEY, state)
    ExtensionStorage.reloadWidget(RETAILER_WIDGET_NAME)
    return
  }
  if (Platform.OS === 'android') {
    const { requestWidgetUpdate } = require('react-native-android-widget') as typeof import('react-native-android-widget')
    const { renderRetailerWidget } = require('./android') as typeof import('./android')
    await requestWidgetUpdate({ widgetName: RETAILER_WIDGET_NAME, renderWidget: () => renderRetailerWidget(state) })
  }
}
