import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { Easing, FadeInDown, useReducedMotion } from 'react-native-reanimated'
import { colors } from '../theme'

/** A reward shown as a perforated ticket: the shop's colour on top with what
 * the reward is, a punched tear line, and a white stub with the code staff
 * scan. Tickets slide in one after another when the Rewards tab opens. */

const NOTCH = 22

function readableOn(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return '#FFFFFF'
  const n = parseInt(m[1], 16)
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
  return lum > 0.62 ? colors.ink : '#FFFFFF'
}

export function Ticket({
  index = 0,
  color,
  shopName,
  title,
  code,
  expiresAt,
  pageColor,
  children,
}: {
  index?: number
  color: string
  shopName: string
  title: string
  code: string
  expiresAt?: string | null
  /** The screen behind the ticket, so the punched notches look cut out. */
  pageColor: string
  children: ReactNode
}) {
  const reducedMotion = useReducedMotion()
  const on = readableOn(color)
  const expires = expiresAt ? new Date(expiresAt) : null
  return (
    <Animated.View
      entering={reducedMotion ? undefined : FadeInDown.delay(Math.min(index, 5) * 90).duration(420).easing(Easing.out(Easing.cubic))}
      style={styles.ticket}
      accessible
      accessibilityLabel={`${title} at ${shopName}. Code ${code}.`}
    >
      <View style={[styles.top, { backgroundColor: color }]}>
        <View style={styles.topRow}>
          <Text style={[styles.shop, { color: on }]} numberOfLines={1}>{shopName}</Text>
          <View style={[styles.admit, { borderColor: on }]}>
            <Text style={[styles.admitText, { color: on }]}>REWARD</Text>
          </View>
        </View>
        <Text style={[styles.title, { color: on }]} numberOfLines={3}>{title}</Text>
        {expires && !Number.isNaN(expires.getTime()) ? (
          <Text style={[styles.expiry, { color: on }]}>
            Use by {expires.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
        ) : null}
      </View>

      {/* Tear line: two punched notches joined by a dashed perforation. */}
      <View style={styles.tear}>
        <View style={[styles.notch, styles.notchLeft, { backgroundColor: pageColor }]} />
        <View style={styles.perforation} />
        <View style={[styles.notch, styles.notchRight, { backgroundColor: pageColor }]} />
      </View>

      <View style={styles.stub}>
        {children}
        <Text style={styles.codeLabel}>SHOW THIS AT THE COUNTER</Text>
        <Text style={styles.code}>{code}</Text>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  ticket: {
    marginTop: 4,
    marginBottom: 18,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    shadowColor: '#1A2138',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  top: { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 22 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  shop: { flex: 1, fontSize: 12, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', opacity: 0.85 },
  admit: { borderWidth: 1.5, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, opacity: 0.8 },
  admitText: { fontSize: 9, fontWeight: '800', letterSpacing: 1.4 },
  title: { fontSize: 26, lineHeight: 30, fontWeight: '800', letterSpacing: -0.6, marginTop: 14 },
  expiry: { fontSize: 12, marginTop: 8, opacity: 0.75 },
  tear: { height: NOTCH, justifyContent: 'center', backgroundColor: '#FFFFFF' },
  perforation: {
    marginHorizontal: NOTCH / 2 + 8,
    borderTopWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#DDD8CE',
  },
  notch: { position: 'absolute', width: NOTCH, height: NOTCH, borderRadius: NOTCH / 2, top: 0 },
  notchLeft: { left: -NOTCH / 2 },
  notchRight: { right: -NOTCH / 2 },
  stub: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 20,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    backgroundColor: '#FFFFFF',
  },
  codeLabel: { marginTop: 14, fontSize: 10, fontWeight: '800', letterSpacing: 1.4, color: colors.muted },
  code: { marginTop: 4, fontSize: 20, fontWeight: '800', letterSpacing: 3, color: colors.ink, fontVariant: ['tabular-nums'] },
})
