// App colours, light (default) or dark, chosen by the person in Settings.
// Dark premium (2026-10-20): near-black surfaces, one orange accent, soft white
// type. Light: the shared tokens (the earlier look, same as the website).
// Styles are built once at start-up, so the mode is read synchronously before
// any screen module loads, and changing it restarts the app.
import * as SecureStore from 'expo-secure-store'
import * as Updates from 'expo-updates'
import { DevSettings } from 'react-native'
import { colors as base, fonts, radius } from '@loyalty-loop/design-tokens'

export type ThemeMode = 'light' | 'dark'
const KEY = 'theme_mode'

function readMode(): ThemeMode {
  try {
    return SecureStore.getItem(KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export const themeMode: ThemeMode = readMode()
export const isDark = themeMode === 'dark'

/** The value for the current mode. */
export function pick<T>(light: T, dark: T): T {
  return isDark ? dark : light
}

/** Saves the choice and restarts the app so every screen picks it up. */
export async function setThemeMode(mode: ThemeMode) {
  if (mode === themeMode) return
  try {
    await SecureStore.setItemAsync(KEY, mode)
  } catch {
    return
  }
  try {
    await Updates.reloadAsync()
  } catch {
    DevSettings.reload()
  }
}

const dark = {
  ...base,
  background: '#0A0B0A',
  foreground: '#F4F3EF',
  card: '#151716',
  primary: '#F2672A',
  primaryHover: '#FF7A3D',
  accent: '#FF8A4C',
  funGreen: '#4CC07A',
  ink: '#F4F3EF',
  muted: '#9DA49E',
  destructive: '#FF6B60',
  border: 'rgba(255,255,255,0.09)',
  olive: '#2A3A25',
  oliveInk: '#E3EDD9',
  sage: '#1A2418',
  sageInk: '#CFE0C4',
  peach: '#2E1C14',
  peachInk: '#F8C9B0',
  orange: '#F2672A',
  orangeInk: '#1A0C05',
}

export const colors: typeof dark = isDark ? dark : { ...base }

export { fonts, radius }
