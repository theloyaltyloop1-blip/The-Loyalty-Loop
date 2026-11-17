import { useCallback, useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { colors, fonts } from '@loyalty-loop/design-tokens'
import { supabase } from '../supabase'
import { Whirl } from '../Whirl'
import { useWhirlVariant } from '../../../../packages/whirl/native'
import { Sheet } from './Sheet'
import {
  COPY, MAX_INPUT_CHARS, NOTICE_KEY, NOTICE_TEXT, STARTERS, classifyFailure, poseFor, resolvePose, toRequestMessages,
  type AskMode, type AskState, type ChatMessage,
} from '../ask-whirl-core'

/**
 * "Ask Whirl": a chat sheet that needs no existing-screen edits. Mount it
 * anywhere and open it with `visible`. The chat lives in memory only and is
 * cleared when the sheet closes. Server functions: shopper -> `ask-whirl`,
 * business -> `business-coach-chat` (both rate limited, signed-in only).
 *
 * Colours are the app's theme tokens, which follow light or dark; `useWhirlVariant()`
 * re-renders the sheet when the scheme changes.
 */
export type AskWhirlProps = {
  visible: boolean
  onClose: () => void
  mode: AskMode
  /** Business mode: the shop being asked about. */
  businessId?: string
  /** Business mode: aggregate numbers only (counts, never customers). */
  stats?: unknown
  /** Shopper mode: coarse location, rounded again before sending. */
  near?: { lat: number; lng: number } | null
  /** Shopper mode: turn a shop id from an answer into a chip; return null to hide it. */
  resolveShop?: (id: string) => { name: string } | null
  onOpenShop?: (id: string) => void
}

type Turn = ChatMessage & { shopIds?: string[]; failed?: boolean }

const palette = () => ({ bg: colors.background, card: colors.card, ink: colors.ink, muted: colors.muted, border: colors.border, accent: colors.primary, onAccent: colors.onPrimary, bubble: colors.sage })

async function failureFrom(error: unknown): Promise<AskState> {
  const ctx = (error as { context?: unknown } | null)?.context
  if (ctx && typeof (ctx as Response).status === 'number') {
    const res = ctx as Response
    let body: unknown = null
    try { body = await res.clone().json() } catch { /* no body */ }
    return classifyFailure(res.status, body)
  }
  return classifyFailure(null, null)
}

export function AskWhirlSheet({ visible, onClose, mode, businessId, stats, near, resolveShop, onOpenShop }: AskWhirlProps) {
  useWhirlVariant()
  const t = palette()
  const [turns, setTurns] = useState<Turn[]>([])
  const [state, setState] = useState<AskState>('idle')
  const [input, setInput] = useState('')
  const [notice, setNotice] = useState<'loading' | 'show' | 'seen'>('loading')
  const [thumbs, setThumbs] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)
  const lastQuestion = useRef('')
  const scroller = useRef<ScrollView>(null)
  const alive = useRef(true)

  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {})
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion)
    return () => sub.remove()
  }, [])

  // The notice is shown the first time only; the flag is a tiny local value.
  useEffect(() => {
    if (!visible) return
    SecureStore.getItemAsync(NOTICE_KEY).then((v) => setNotice(v ? 'seen' : 'show')).catch(() => setNotice('show'))
  }, [visible])

  // Closing the sheet clears the chat: nothing is kept.
  useEffect(() => {
    if (visible) return
    setTurns([]); setState('idle'); setInput(''); setThumbs(false)
  }, [visible])

  const acceptNotice = () => {
    setNotice('seen')
    SecureStore.setItemAsync(NOTICE_KEY, '1').catch(() => {})
  }

  const send = useCallback(async (raw: string, retry = false) => {
    const text = raw.trim()
    if (!text || state === 'thinking') return
    lastQuestion.current = text
    const history: ChatMessage[] = turns.filter((x) => !x.failed).map(({ role, content }) => ({ role, content }))
    const messages = toRequestMessages(history, text)
    setTurns((prev) => (retry ? prev.map((x) => (x.failed ? { ...x, failed: false } : x)) : [...prev, { role: 'user', content: text }]))
    setInput('')
    setState('thinking')
    setThumbs(false)
    try {
      const { data, error } = mode === 'shopper'
        ? await supabase.functions.invoke('ask-whirl', { body: { messages, near: near ?? null, client: 'shopper' } })
        : await supabase.functions.invoke('business-coach-chat', { body: { business_id: businessId, messages, stats } })
      if (!alive.current) return
      if (error) {
        const next = await failureFrom(error)
        if (!alive.current) return
        setTurns((prev) => prev.map((x, i) => (i === prev.length - 1 && x.role === 'user' ? { ...x, failed: true } : x)))
        setState(next)
        return
      }
      const reply = typeof data?.reply === 'string' ? data.reply.replace(/\s*\{\s*"reply"\s*:[\s\S]*$/, '').trim() : ''
      if (!reply) { setState('error'); return }
      const ids = Array.isArray(data?.shop_ids) ? (data.shop_ids as unknown[]).filter((x): x is string => typeof x === 'string') : []
      setTurns((prev) => [...prev, { role: 'assistant', content: reply, shopIds: ids }])
      setState(data?.refused ? 'refused' : 'answered')
      if (!data?.refused) {
        setThumbs(true)
        setTimeout(() => alive.current && setThumbs(false), 900)
      }
    } catch {
      if (!alive.current) return
      setState('error')
    }
  }, [turns, state, mode, businessId, stats, near])

  useEffect(() => { setTimeout(() => scroller.current?.scrollToEnd({ animated: !reduceMotion }), 60) }, [turns.length, state, reduceMotion])

  const shownPose = resolvePose(thumbs ? 'thumbs' : poseFor(state, turns.length > 0))
  const problem = state in COPY ? COPY[state as keyof typeof COPY] : null
  const blocked = state === 'offline' || state === 'minute' || state === 'day' || state === 'resting'

  return (
    <Sheet visible={visible} onClose={onClose} sheetStyle={[s.sheet, { backgroundColor: t.bg, borderColor: t.border, maxHeight: '88%' }]}>
      <View style={s.wrap}>
        <View style={[s.handle, { backgroundColor: t.border }]} />
        {notice === 'show' ? (
          <View style={s.center}>
            <Whirl pose="wave" size={96} />
            <Text style={[s.h1, { color: t.ink }]}>Hi, I'm Whirl</Text>
            <Text style={[s.body, { color: t.muted }]}>{NOTICE_TEXT}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Got it" onPress={acceptNotice} style={[s.primary, { backgroundColor: t.accent }]}>
              <Text style={[s.primaryText, { color: t.onAccent }]}>Got it</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <ScrollView ref={scroller} style={s.scroll} contentContainerStyle={s.scrollIn} keyboardShouldPersistTaps="handled">
              {turns.length === 0 ? (
                <View style={s.center}>
                  <Whirl pose={shownPose} size={96} />
                  <Text style={[s.h1, { color: t.ink }]}>Ask Whirl anything</Text>
                  <Text style={[s.body, { color: t.muted }]}>{mode === 'shopper' ? 'About stamps, rewards, or finding a shop.' : 'About your loyalty programme, your numbers, or using the app.'}</Text>
                  {STARTERS[mode].map((q) => (
                    <Pressable key={q} accessibilityRole="button" onPress={() => send(q)} style={[s.chip, { backgroundColor: t.card, borderColor: t.border }]}>
                      <Text style={[s.chipText, { color: t.ink }]}>{q}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                turns.map((m, i) => (
                  <View key={i} style={m.role === 'user' ? s.rowUser : s.rowBot}>
                    <View style={[s.bubble, m.role === 'user' ? { backgroundColor: t.accent } : { backgroundColor: t.card, borderWidth: 1, borderColor: t.border }]}>
                      <Text style={[s.bubbleText, { color: m.role === 'user' ? t.onAccent : t.ink }]}>{m.content}</Text>
                    </View>
                    {m.shopIds?.map((id) => {
                      const shop = resolveShop?.(id)
                      return shop ? (
                        <Pressable key={id} accessibilityRole="button" accessibilityLabel={`Open ${shop.name}`} onPress={() => onOpenShop?.(id)} style={[s.shopChip, { backgroundColor: t.card, borderColor: t.border }]}>
                          <Text style={[s.chipText, { color: t.ink }]}>{shop.name}</Text>
                        </Pressable>
                      ) : null
                    })}
                  </View>
                ))
              )}
              {state === 'thinking' ? (
                <View style={s.rowBot} accessibilityLiveRegion="polite" accessibilityLabel="Whirl is thinking">
                  <View style={[s.bubble, { backgroundColor: t.bubble, flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                    <Whirl pose="think" size={28} />
                    <Dots color={t.muted} still={reduceMotion} />
                  </View>
                </View>
              ) : null}
              {problem ? (
                <View style={s.problem} accessibilityLiveRegion="polite">
                  {turns.length > 0 ? <Whirl pose={shownPose} size={56} /> : null}
                  <Text style={[s.body, { color: t.ink, textAlign: 'center' }]}>{problem.text}</Text>
                  {problem.retry ? (
                    <Pressable accessibilityRole="button" onPress={() => send(lastQuestion.current, true)} style={[s.primary, { backgroundColor: t.accent }]}>
                      <Text style={[s.primaryText, { color: t.onAccent }]}>Try again</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </ScrollView>
            <View style={[s.inputRow, { borderColor: t.border, backgroundColor: t.card }]}>
              <TextInput
                value={input}
                onChangeText={setInput}
                editable={!blocked || state === 'minute'}
                placeholder={blocked && state !== 'minute' ? 'Whirl is resting' : 'Ask Whirl…'}
                placeholderTextColor={t.muted}
                maxLength={MAX_INPUT_CHARS}
                multiline
                accessibilityLabel="Your question for Whirl"
                style={[s.input, { color: t.ink }]}
                onSubmitEditing={() => send(input)}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Send"
                accessibilityState={{ disabled: !input.trim() || state === 'thinking' || (blocked && state !== 'minute') }}
                disabled={!input.trim() || state === 'thinking' || (blocked && state !== 'minute')}
                onPress={() => send(input)}
                style={[s.send, { backgroundColor: t.accent, opacity: !input.trim() || state === 'thinking' ? 0.4 : 1 }]}
              >
                <Text style={[s.primaryText, { color: t.onAccent }]}>Send</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </Sheet>
  )
}

/** Three dots that bounce one after another. Still when reduced motion is on. */
function Dots({ color, still }: { color: string; still: boolean }) {
  const vals = useRef([0, 1, 2].map(() => new Animated.Value(0))).current
  useEffect(() => {
    if (still) return
    const loops = vals.map((v, i) => Animated.loop(Animated.sequence([
      Animated.delay(i * 140),
      Animated.timing(v, { toValue: 1, duration: 280, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 280, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.delay(420 - i * 140),
    ])))
    loops.forEach((l) => l.start())
    return () => loops.forEach((l) => l.stop())
  }, [still, vals])
  return (
    <View style={{ flexDirection: 'row', gap: 5 }}>
      {vals.map((v, i) => (
        <Animated.View key={i} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color, opacity: still ? 0.7 : v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }), transform: still ? [] : [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }] }} />
      ))}
    </View>
  )
}

const s = StyleSheet.create({
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderBottomWidth: 0, overflow: 'hidden', shadowColor: '#000000', shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: -6 }, elevation: 16 },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginTop: 10, marginBottom: 14 },
  wrap: { paddingHorizontal: 16, paddingBottom: 24, minHeight: 360 },
  scroll: { flexGrow: 0, maxHeight: 440 },
  scrollIn: { paddingVertical: 8, gap: 10 },
  center: { alignItems: 'center', gap: 10, paddingVertical: 12 },
  h1: { fontFamily: fonts.nativeDisplay, fontSize: 22, textAlign: 'center' },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, textAlign: 'center' },
  chip: { borderWidth: 1, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 16, alignSelf: 'stretch' },
  chipText: { fontFamily: fonts.body, fontSize: 15 },
  rowUser: { alignItems: 'flex-end', gap: 6 },
  rowBot: { alignItems: 'flex-start', gap: 6 },
  bubble: { maxWidth: '86%', borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14 },
  bubbleText: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22 },
  shopChip: { borderWidth: 1, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12 },
  problem: { alignItems: 'center', gap: 10, paddingVertical: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, borderWidth: 1, borderRadius: 20, padding: 6, marginTop: 8 },
  input: { flex: 1, fontFamily: fonts.body, fontSize: 16, maxHeight: 110, paddingHorizontal: 10, paddingVertical: 8 },
  send: { borderRadius: 16, alignSelf: 'flex-end', paddingVertical: 10, paddingHorizontal: 16 },
  primary: { borderRadius: 16, paddingVertical: 12, paddingHorizontal: 22, alignSelf: 'center' },
  primaryText: { fontFamily: fonts.nativeDisplaySemibold, fontSize: 15 },
})
