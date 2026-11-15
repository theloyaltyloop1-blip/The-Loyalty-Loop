import React from 'react'
import * as SecureStore from 'expo-secure-store'
import { WhirlProvider, useWhirlSettings, Whirl as KitWhirl, type WhirlEffect, type WhirlPose, type WhirlStorage } from '../../../packages/whirl/native'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import { useTheme } from './theme'

// The mascot now comes from the shared kit (packages/whirl). This file is the app's thin adapter: it feeds the kit the app
// theme (light or dark art), a SecureStore-backed memory for the "Show Whirl" switch and the once-only tips, and gives every
// existing <Whirl pose size /> call a small one-shot animation. Rules: docs/whirl-usage-rules.md.
const storage: WhirlStorage = {
  getItem: (k) => SecureStore.getItemAsync(k),
  setItem: (k, v) => SecureStore.setItemAsync(k, v),
}

/** Mount once inside ThemeProvider. */
export function AppWhirlProvider({ children }: { children: React.ReactNode }) {
  const { isDark } = useTheme()
  return <WhirlProvider isDark={isDark} storage={storage}>{children}</WhirlProvider>
}

const DEFAULT_EFFECT: Partial<Record<WhirlPose, WhirlEffect>> = { wave: 'wave', celebrate: 'celebrate', oops: 'oops', thumbs: 'pop', stamp: 'stamp', peek: 'peek' }

/** Whirl, the Loyalty Loop mascot. Hidden when the user turns "Show Whirl" off. Decorative: hidden from screen readers. */
export function Whirl({ pose, size = 96, style, effect, variant }: { pose: WhirlPose; size?: number; style?: StyleProp<ViewStyle>; effect?: WhirlEffect; variant?: 'light' | 'dark' }) {
  return <KitWhirl pose={pose} size={size} style={style} effect={effect ?? DEFAULT_EFFECT[pose] ?? 'none'} variant={variant} />
}

/** A Whirl above an empty-state message. When "Show Whirl" is off (or `show` is false) only the message is drawn. */
export function WhirlEmpty({ pose = 'sleepy', size = 96, show = true, children }: { pose?: WhirlPose; size?: number; show?: boolean; children: React.ReactNode }) {
  return (
    <View style={{ alignItems: 'center' }}>
      {show ? <Whirl pose={pose} size={size} /> : null}
      {children}
    </View>
  )
}

/** The text "↻" badge that stood in for a logo on sign-in and lock screens: a waving Whirl when allowed, the old badge otherwise. */
export function WhirlOrMark({ pose, size = 96, mark }: { pose: WhirlPose; size?: number; mark: React.ReactElement }) {
  const { showWhirl, ready } = useWhirlSettings()
  return showWhirl && ready ? <Whirl pose={pose} size={size} style={{ marginBottom: 10 }} /> : mark
}
