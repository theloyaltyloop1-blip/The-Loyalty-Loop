import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, fonts } from '@loyalty-loop/design-tokens'
import { Whirl } from '../Whirl'
import { useWhirlVariant } from '../../../../packages/whirl/native'

/**
 * The home-screen entry to Ask Whirl: one 72 px row that looks like a
 * message box. Whirl appears beside it (hidden when the user has turned
 * "Show Whirl" off; the row still works). Tapping opens AskWhirlSheet.
 */
export function AskWhirlCard({ onPress, mode }: { onPress: () => void; mode: 'shopper' | 'business' }) {
  useWhirlVariant() // re-render when the scheme changes; the colours below follow it
  const bg = colors.card
  const border = colors.border
  const ink = colors.ink
  const muted = colors.muted
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Ask Whirl anything"
      accessibilityHint={mode === 'shopper' ? 'Opens a chat about stamps, rewards and shops' : 'Opens a chat about your loyalty programme and the app'}
      onPress={onPress}
      style={({ pressed }) => [s.row, { backgroundColor: bg, borderColor: border }, pressed && { opacity: 0.8 }]}
    >
      <Whirl pose="wave" size={48} effect="none" />
      <View style={s.text}>
        <Text style={[s.title, { color: ink }]}>Ask Whirl anything</Text>
        <Text style={[s.sub, { color: muted }]} numberOfLines={1}>{mode === 'shopper' ? 'Stamps, rewards, finding a shop…' : 'Your programme, your numbers, the app…'}</Text>
      </View>
    </Pressable>
  )
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 72, borderWidth: 1, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 8 },
  text: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.nativeDisplaySemibold, fontSize: 16 },
  sub: { fontFamily: fonts.body, fontSize: 14 },
})
