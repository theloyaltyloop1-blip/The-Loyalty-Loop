import React, { useCallback, useEffect, useState } from 'react'
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'

import type { WhirlPose } from '../art.generated'
import { decideMoment, markSeen, shouldShowOnce, whirlBudget } from '../core'
import { Whirl, type WhirlEffect } from './Whirl'
import { useReduceMotion, useWhirlSettings, useWhirlStorage, useWhirlVariant } from './context'

const INK = { light: '#2B1A10', dark: '#F8E4C6' } as const
const MUTED = { light: 'rgba(43, 26, 16, 0.68)', dark: 'rgba(248, 228, 198, 0.72)' } as const

export interface WhirlMomentProps {
  /** Screen this moment lives on. At most one non-loading moment per screenId is ever shown. */
  screenId: string
  /** Unique id of this moment. With `once`, it is remembered forever and never shown again after the first time. */
  momentId: string
  pose: WhirlPose
  line: string
  subline?: string
  /** First-time tip: shown once ever (remembered in storage the moment it appears, so even a crash does not repeat it). */
  once?: boolean
  /** Adds a small close button and lets a tap anywhere dismiss. Default: on for `once` tips, off for empty states. */
  dismissible?: boolean
  size?: number
  effect?: WhirlEffect
  layout?: 'row' | 'stack'
  onDismiss?: () => void
  style?: StyleProp<ViewStyle>
}

/**
 * A pose plus a line of copy. Rules enforced here: hidden when "Show Whirl" is off; at most one per screen; `once` tips never
 * repeat; never modal and never waits for an animation; dismissible tips go away on tap; reduced motion = no animation, no fade.
 */
export function WhirlMoment({ screenId, momentId, pose, line, subline, once = false, dismissible, size = 72, effect = 'pop', layout = 'row', onDismiss, style }: WhirlMomentProps) {
  const variant = useWhirlVariant()
  const { settings, ready } = useWhirlSettings()
  const storage = useWhirlStorage()
  const reduce = useReduceMotion()
  const [visible, setVisible] = useState(false)
  const canDismiss = dismissible ?? once

  useEffect(() => {
    if (!ready) return
    let alive = true
    void (async () => {
      const onceOk = once ? await shouldShowOnce(storage, momentId) : true
      if (!alive) return
      const ok = decideMoment({ settings, screenId, momentId, onceOk })
      if (!ok) {
        setVisible(false)
        return
      }
      setVisible(true)
      if (once) void markSeen(storage, momentId)
    })()
    return () => {
      alive = false
      whirlBudget.release(screenId, momentId)
    }
  }, [ready, settings.showWhirl, screenId, momentId, once])

  const dismiss = useCallback(() => {
    setVisible(false)
    whirlBudget.release(screenId, momentId)
    onDismiss?.()
  }, [screenId, momentId, onDismiss])

  if (!visible) return null
  const stack = layout === 'stack'
  const body = (
    <View style={[{ flexDirection: stack ? 'column' : 'row', alignItems: 'center', gap: stack ? 10 : 12 }, style]}>
      <Whirl pose={pose} size={size} effect={effect} />
      <View style={{ flexShrink: 1, alignItems: stack ? 'center' : 'flex-start' }}>
        <Text style={{ color: INK[variant], fontSize: 16, fontWeight: '700', textAlign: stack ? 'center' : 'left' }}>{line}</Text>
        {subline ? <Text style={{ color: MUTED[variant], fontSize: 14, marginTop: 2, textAlign: stack ? 'center' : 'left' }}>{subline}</Text> : null}
      </View>
      {canDismiss ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" hitSlop={14} onPress={dismiss} style={{ position: 'absolute', top: 0, right: 0, padding: 6 }}>
          <Text style={{ color: MUTED[variant], fontSize: 16 }}>✕</Text>
        </Pressable>
      ) : null}
    </View>
  )
  const content = canDismiss ? (
    <Pressable accessibilityHint="Tap to dismiss" onPress={dismiss}>
      {body}
    </Pressable>
  ) : (
    body
  )
  return reduce ? content : <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)}>{content}</Animated.View>
}

/**
 * For a Whirl that has no text of its own (a greeting peek, a wave on a welcome screen): true when the "Show Whirl" switch is on
 * and nothing else has claimed this screen's one decorative slot. Releases the slot when the screen goes away.
 */
export function useWhirlSlot(screenId: string, momentId: string): boolean {
  const { settings, ready } = useWhirlSettings()
  const [ok, setOk] = useState(false)
  useEffect(() => {
    if (!ready) return
    setOk(decideMoment({ settings, screenId, momentId }))
    return () => whirlBudget.release(screenId, momentId)
  }, [ready, settings.showWhirl, screenId, momentId])
  return ok
}
