// Theme for the phone app (2026-11-15: dark mode). Keep identical in apps/shopper
// and apps/retailer (only this header differs).
//
// The palettes, the live `colors` view, `themed()` and `schemeColor()` live in the shared
// design tokens package. This file adds the React side: the saved Light / Dark /
// System choice, following the phone's setting, and a hook that re-renders the
// screen when the scheme changes.
//
// Everything here is plain JavaScript on purpose, so it ships by OTA. The native
// side (app.json userInterfaceStyle) only decides whether the phone *reports* dark
// to the app; until a store build carries 'automatic', "System" reads as light and
// the manual Light / Dark choice is what works.
import * as React from 'react'
import { Appearance, useColorScheme } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import {
  colors, darkColors, fonts, lightColors, radius, setActiveScheme, themed, schemeColor,
  type ColorScheme,
} from '@loyalty-loop/design-tokens'

export { colors, darkColors, fonts, lightColors, radius, themed, schemeColor }
export type { ColorScheme }

export type ThemePreference = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'loyalty-loop-theme-preference'

function readStoredPreference(): ThemePreference {
  try {
    const value = SecureStore.getItem(STORAGE_KEY)
    if (value === 'light' || value === 'dark') return value
  } catch { /* unreadable: follow the phone */ }
  return 'system'
}

function systemScheme(): ColorScheme {
  try {
    return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

function resolve(preference: ThemePreference, system: ColorScheme): ColorScheme {
  return preference === 'system' ? system : preference
}

// Decide the scheme at import time, before the first screen renders, so a saved
// "Dark" never flashes light on launch.
let savedPreference = readStoredPreference()
setActiveScheme(resolve(savedPreference, systemScheme()))

type ThemeContextValue = {
  scheme: ColorScheme
  isDark: boolean
  preference: ThemePreference
  setPreference: (next: ThemePreference) => void
  colors: typeof colors
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = React.useState<ThemePreference>(savedPreference)
  const system = useColorScheme() === 'dark' ? 'dark' : 'light'
  const scheme = resolve(preference, system)
  // Set during render (not in an effect) so this render already paints the right scheme.
  setActiveScheme(scheme)

  const setPreference = React.useCallback((next: ThemePreference) => {
    savedPreference = next
    setPreferenceState(next)
    try {
      if (next === 'system') SecureStore.deleteItemAsync(STORAGE_KEY).catch(() => {})
      else SecureStore.setItemAsync(STORAGE_KEY, next).catch(() => {})
    } catch { /* not saved: still applies for this session */ }
  }, [])

  const value = React.useMemo<ThemeContextValue>(
    () => ({ scheme, isDark: scheme === 'dark', preference, setPreference, colors }),
    [scheme, preference, setPreference],
  )
  return React.createElement(ThemeContext.Provider, { value }, children)
}

/**
 * Call this in any component that is the root of its own tree (a screen, a sheet,
 * a modal host) so it re-renders when the scheme changes. Everything below it
 * re-renders with it, and reads colours through `colors` / `styles` / `schemeColor()`.
 */
export function useTheme(): ThemeContextValue {
  const context = React.useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>')
  return context
}

/** Status bar text colour for the current scheme: light text on dark, dark on light. */
export function statusBarStyle(isDark: boolean, onDarkHero = false): 'light-content' | 'dark-content' {
  return isDark || onDarkHero ? 'light-content' : 'dark-content'
}
