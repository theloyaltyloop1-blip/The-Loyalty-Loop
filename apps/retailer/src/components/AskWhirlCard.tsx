import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, fonts, schemeColor } from '@loyalty-loop/design-tokens'
import { Whirl } from '../Whirl'

/**
 * The home-screen entry to Ask Whirl: one 72 px row that looks like a
 * message box. Whirl appears beside it (hidden when the user has turned
 * "Show Whirl" off; the row still works). Tapping opens AskWhirlSheet.
 */
export function AskWhirlCard({ onPress, mode }: { onPress: () => void; mode: 'shopper' | 'business' }) {
  // The peach AI card (owner rule): theme tokens, so light and dark both follow the app.
  const bg = colors.peach
  const border = schemeColor('#2A2A2A', 'border')
  const ink = colors.peachInk
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Ask Whirl anything"
      accessibilityHint={mode === 'shopper' ? 'Opens a chat about stamps, rewards and shops' : 'Opens a chat about your loyalty programme and the app'}
      onPress={onPress}
      style={({ pressed }) => [s.row, { backgroundColor: bg, borderColor: border }, pressed && { opacity: 0.8 }]}
    >
      <Whirl pose="peek" size={56} effect="none" />
      <View style={s.text}>
        <Text style={[s.title, { color: ink }]}>Ask Whirl anything</Text>
        <Text style={[s.sub, { color: ink }]} numberOfLines={1}>{mode === 'shopper' ? 'Stamps, rewards, finding a shop…' : 'Your programme, your numbers, the app…'}</Text>
      </View>
    </Pressable>
  )
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 72, borderWidth: 2, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 8 },
  text: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.nativeDisplaySemibold, fontSize: 16 },
  sub: { fontFamily: fonts.body, fontSize: 14, opacity: 0.8 },
})
