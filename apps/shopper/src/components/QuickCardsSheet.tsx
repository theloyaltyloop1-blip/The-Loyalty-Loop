import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import * as Haptics from 'expo-haptics'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Sheet } from './Sheet'
import { INK, MUTED, NIGHT, PAPER, SANS_HEAVY, SANS_MEDIUM, STONE } from './Poster'
import { homeProgress, type HomeMember, type HomeShop, type HomeTier } from '../home-progress'
import { shopMoney } from '../money'
import { QUICK_CARDS_MAX, toggleQuickCard } from '../quick-cards'

/** Pick which of your cards sit at the top of home. Numbers show the order
 * they'll appear in; picking none keeps the automatic "closest to a reward". */
export function QuickCardsSheet<T extends HomeShop>({ visible, onClose, shops, memberships, catalog, selected, onChange }: {
  visible: boolean
  onClose: () => void
  /** Joined shops only. */
  shops: T[]
  memberships: HomeMember[]
  catalog: HomeTier[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const full = selected.length >= QUICK_CARDS_MAX
  return (
    <Sheet visible={visible} onClose={onClose} sheetStyle={s.sheet} dragArea="handle" dragAreaHeight={44}>
      <SafeAreaView edges={['bottom']}>
        <View style={s.handle} />
        <Text accessibilityRole="header" style={s.title}>Quick cards</Text>
        <Text style={s.intro}>
          Pick up to {QUICK_CARDS_MAX} cards to keep at the top of home. Pick none and we’ll show the card closest to a reward.
        </Text>
        <ScrollView style={s.list} contentContainerStyle={s.listContent}>
          {shops.map(shop => {
            const position = selected.indexOf(shop.id)
            const on = position >= 0
            const disabled = !on && full
            const member = memberships.find(m => m.business_id === shop.id)
            const progress = homeProgress(shop, member, catalog, shopMoney(shop.country_code))
            return (
              <Pressable
                key={shop.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on, disabled }}
                accessibilityLabel={`${shop.name}. ${progress.label}`}
                accessibilityHint={disabled ? `You can pick up to ${QUICK_CARDS_MAX}. Remove one first.` : undefined}
                onPress={() => {
                  if (disabled) { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); return }
                  void Haptics.selectionAsync()
                  onChange(toggleQuickCard(selected, shop.id))
                }}
                style={({ pressed }) => [s.row, on && s.rowOn, disabled && s.rowDisabled, pressed && s.pressed]}
              >
                <View style={s.logo}>
                  {shop.logo_url
                    ? <Image accessibilityIgnoresInvertColors source={{ uri: shop.logo_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                    : <Text style={s.logoText}>{shop.name.trim().charAt(0).toUpperCase()}</Text>}
                </View>
                <View style={s.copy}>
                  <Text style={s.name} numberOfLines={1}>{shop.name}</Text>
                  <Text style={s.meta} numberOfLines={1}>{progress.label}</Text>
                </View>
                <View style={[s.check, on && s.checkOn]}>
                  {on && <Text style={s.checkText}>{position + 1}</Text>}
                </View>
              </Pressable>
            )
          })}
        </ScrollView>
        <View style={s.footer}>
          {selected.length > 0 ? (
            <Pressable accessibilityRole="button" onPress={() => onChange([])} hitSlop={8}>
              <Text style={s.clear}>Use automatic</Text>
            </Pressable>
          ) : <Text style={s.auto}>Automatic</Text>}
          <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [s.done, pressed && s.pressed]}>
            <Text style={s.doneText}>Done</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Sheet>
  )
}

const s = StyleSheet.create({
  sheet: { backgroundColor: PAPER, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, maxHeight: '85%' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.15)', alignSelf: 'center', marginBottom: 18 },
  title: { fontFamily: SANS_HEAVY, fontSize: 30, letterSpacing: -1.2, color: INK },
  intro: { marginTop: 6, marginBottom: 16, fontSize: 15, lineHeight: 21, color: MUTED },
  list: { flexGrow: 0 },
  listContent: { gap: 8, paddingBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 10, paddingRight: 14, borderWidth: 2, borderColor: 'transparent' },
  rowOn: { borderColor: NIGHT },
  rowDisabled: { opacity: 0.45 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.985 }] },
  logo: { width: 48, height: 48, borderRadius: 14, backgroundColor: STONE, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logoText: { color: INK, fontSize: 18, fontWeight: '700' },
  copy: { flex: 1, minWidth: 0, gap: 3 },
  name: { fontSize: 16, fontWeight: '700', letterSpacing: -0.3, color: INK },
  meta: { fontSize: 13, color: MUTED },
  check: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: 'rgba(26,33,56,0.25)', alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: NIGHT, borderColor: NIGHT },
  checkText: { color: PAPER, fontSize: 13, fontWeight: '800' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  clear: { color: NIGHT, fontFamily: SANS_MEDIUM, fontSize: 15 },
  auto: { color: MUTED, fontSize: 14 },
  done: { height: 50, paddingHorizontal: 30, borderRadius: 999, backgroundColor: NIGHT, alignItems: 'center', justifyContent: 'center' },
  doneText: { color: PAPER, fontFamily: SANS_MEDIUM, fontSize: 16 },
})
