import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { colors, schemeColor, themed } from '@loyalty-loop/design-tokens'
import { supabase } from '../supabase'
import { showAlert } from './AppAlert'
import { Sheet } from './Sheet'
import { haptic } from '../haptics'

// Birthday rewards. The shopper gives a day and month; we store it in
// profiles.birthday with the year 2000 (a leap year, so 29 February is valid).
// Only the shopper can read or change it. Shops never see the date: they only
// learn a birthday bonus was given when it is.

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAYS_IN = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

/** "15 March", or null for no birthday. */
export function formatBirthday(value: string | null | undefined) {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(value ?? '')
  return m ? `${Number(m[2])} ${MONTHS[Number(m[1]) - 1]}` : null
}
const partsOf = (value: string | null | undefined) => {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(value ?? '')
  return m ? { month: Number(m[1]), day: Number(m[2]) } : null
}

// One shared copy, so the account sheet and shop pages agree after a save.
// undefined = not loaded yet, null = none given.
let cached: { userId: string; birthday: string | null } | null = null
const listeners = new Set<(birthday: string | null) => void>()

export function useMyBirthday(userId: string) {
  const [birthday, setBirthday] = useState<string | null | undefined>(cached?.userId === userId ? cached.birthday : undefined)
  useEffect(() => {
    let active = true
    const listen = (next: string | null) => { if (active) setBirthday(next) }
    listeners.add(listen)
    if (cached?.userId !== userId) {
      void supabase.from('profiles').select('birthday').eq('id', userId).maybeSingle().then(({ data, error }) => {
        if (error || !active) return
        cached = { userId, birthday: (data?.birthday as string | null) ?? null }
        listeners.forEach((l) => l(cached!.birthday))
      })
    }
    return () => { active = false; listeners.delete(listen) }
  }, [userId])

  async function save(month: number | null, day: number | null) {
    const value = month && day ? `2000-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` : null
    const { error } = await supabase.from('profiles').update({ birthday: value }).eq('id', userId)
    if (error) return false
    cached = { userId, birthday: value }
    listeners.forEach((l) => l(value))
    return true
  }
  return { birthday, save }
}

/** Month then day, as coloured chips. Saves straight to the profile. */
export function BirthdayPicker({ userId, onDone }: { userId: string; onDone?: () => void }) {
  const { birthday, save } = useMyBirthday(userId)
  const current = partsOf(birthday)
  const [month, setMonth] = useState<number | null>(current?.month ?? null)
  const [day, setDay] = useState<number | null>(current?.day ?? null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const p = partsOf(birthday)
    setMonth(p?.month ?? null)
    setDay(p?.day ?? null)
  }, [birthday])

  async function submit(remove = false) {
    if (!remove && (!month || !day)) return showAlert('Pick a day and month', 'Choose the month first, then the day.')
    setBusy(true)
    const ok = await save(remove ? null : month, remove ? null : day)
    setBusy(false)
    if (!ok) return showAlert('Could not save your birthday', 'Check the connection and try again.')
    haptic.success()
    onDone?.()
  }

  const days = month ? DAYS_IN[month - 1] : 31
  return (
    <View style={s.picker}>
      <Text style={s.why}>Shops that give birthday treats add a little extra on your first visit in your birthday month. Shops never see your birthday, and we don’t need the year.</Text>
      <Text style={s.label}>Month</Text>
      <View style={s.chips}>
        {MONTHS.map((name, i) => {
          const on = month === i + 1
          return (
            <Pressable key={name} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={name}
              onPress={() => { setMonth(i + 1); if (day && day > DAYS_IN[i]) setDay(null) }}
              style={[s.chip, s.monthChip, on && s.chipOn]}>
              <Text style={[s.chipText, on && s.chipTextOn]}>{name.slice(0, 3)}</Text>
            </Pressable>
          )
        })}
      </View>
      <Text style={s.label}>Day</Text>
      <View style={s.chips}>
        {Array.from({ length: days }, (_, i) => i + 1).map((d) => {
          const on = day === d
          return (
            <Pressable key={d} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`Day ${d}`}
              onPress={() => setDay(d)} style={[s.chip, s.dayChip, on && s.chipOn]}>
              <Text style={[s.chipText, on && s.chipTextOn]}>{d}</Text>
            </Pressable>
          )
        })}
      </View>
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => void submit()} style={[s.save, busy && { opacity: 0.6 }]}>
        <Text style={s.saveText}>{busy ? 'Saving…' : month && day ? `Save ${day} ${MONTHS[month - 1]}` : 'Save'}</Text>
      </Pressable>
      {birthday ? (
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void submit(true)} hitSlop={8} style={s.remove}>
          <Text style={s.removeText}>Remove my birthday</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const DISMISS_KEY = 'birthday_prompt_dismissed'

/**
 * On a shop page, for members of a shop with a birthday reward:
 *  - no birthday given yet: a gentle invite to add it (until added or "Not now");
 *  - in their birthday month and not yet given this year: "Birthday treat waiting".
 * Shows nothing until the database has the birthday reward (birthday_bonus undefined).
 */
export function ShopBirthdayCard({ userId, businessId, bonus, item, unit, member }: {
  userId: string; businessId: string; bonus: number | null | undefined; item?: string | null; unit: string; member: boolean
}) {
  const { birthday } = useMyBirthday(userId)
  const [dismissed, setDismissed] = useState<boolean | null>(null)
  const [claimed, setClaimed] = useState<boolean | null>(null)
  const [picking, setPicking] = useState(false)
  const parts = partsOf(birthday)
  const now = new Date()
  const birthdayMonth = !!parts && parts.month === now.getMonth() + 1

  useEffect(() => {
    SecureStore.getItemAsync(DISMISS_KEY).then((v) => setDismissed(v === 'yes')).catch(() => setDismissed(false))
  }, [])
  useEffect(() => {
    if (!birthdayMonth || (!bonus && !item)) { setClaimed(null); return }
    let active = true
    void supabase.from('programme_bonus_log').select('id').eq('user_id', userId).eq('business_id', businessId)
      .eq('kind', 'birthday').eq('period', String(now.getFullYear())).limit(1)
      .then(({ data, error }) => { if (active) setClaimed(error ? null : (data?.length ?? 0) > 0) })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, businessId, birthdayMonth, bonus, item])

  if (!member || (!bonus && !item) || birthday === undefined) return null
  const amount = item ?? `${bonus} bonus ${bonus === 1 ? unit.replace(/s$/, '') : unit}`

  if (birthdayMonth) {
    if (claimed !== false) return null
    return (
      <View style={[s.card, s.cardWaiting]} accessibilityRole="text">
        <Text style={s.cardTitle}>🎂 Birthday treat waiting</Text>
        <Text style={s.cardBody}>Happy birthday month! Visit before the month ends and {item ? `your ${amount} is waiting for you` : `you get ${amount}`}.</Text>
      </View>
    )
  }
  if (birthday || dismissed !== false) return null
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>🎂 A birthday treat</Text>
      <Text style={s.cardBody}>This shop gives {amount} on your first visit in your birthday month. Add your birthday so it can.</Text>
      <View style={s.cardButtons}>
        <Pressable accessibilityRole="button" onPress={() => setPicking(true)} style={s.cardButton}>
          <Text style={s.cardButtonText}>Add my birthday</Text>
        </Pressable>
        <Pressable accessibilityRole="button" hitSlop={8} onPress={() => { setDismissed(true); void SecureStore.setItemAsync(DISMISS_KEY, 'yes').catch(() => undefined) }} style={s.cardLater}>
          <Text style={s.cardLaterText}>Not now</Text>
        </Pressable>
      </View>
      <Sheet visible={picking} onClose={() => setPicking(false)} sheetStyle={s.sheet}>
        <View style={s.sheetHandle} />
        <Text style={s.sheetTitle}>Your birthday</Text>
        <BirthdayPicker userId={userId} onDone={() => setPicking(false)} />
      </Sheet>
    </View>
  )
}

const AMBER_BG = '#FBE7BF'
const AMBER_INK = '#5C3B00'

const s = themed(() => StyleSheet.create({
  picker: { gap: 10 },
  why: { color: schemeColor('#000000', 'fg'), fontSize: 14, lineHeight: 20 },
  label: { fontSize: 14, fontWeight: '600', color: schemeColor('#000000', 'fg'), marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: schemeColor(AMBER_BG, 'bg') },
  monthChip: { width: '22%', flexGrow: 1 },
  dayChip: { width: 44 },
  chipOn: { backgroundColor: colors.primary },
  chipText: { fontSize: 15, fontWeight: '600', color: schemeColor(AMBER_INK, 'fg') },
  chipTextOn: { color: colors.onPrimary },
  save: { marginTop: 12, minHeight: 50, borderRadius: 25, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: colors.onPrimary, fontSize: 16, fontWeight: '700' },
  remove: { alignSelf: 'center', paddingVertical: 8 },
  removeText: { color: schemeColor('#b54439', 'fg'), fontSize: 14, fontWeight: '600' },
  card: { marginTop: 16, borderRadius: 20, padding: 16, gap: 6, backgroundColor: schemeColor(AMBER_BG, 'bg') },
  cardWaiting: { backgroundColor: schemeColor('#FDE2D2', 'bg') },
  cardTitle: { fontSize: 16, fontWeight: '700', color: schemeColor(AMBER_INK, 'fg') },
  cardBody: { fontSize: 14, lineHeight: 20, color: schemeColor(AMBER_INK, 'fg') },
  cardButtons: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 6 },
  cardButton: { minHeight: 44, paddingHorizontal: 18, borderRadius: 22, backgroundColor: colors.primary, justifyContent: 'center' },
  cardButtonText: { color: colors.onPrimary, fontWeight: '700', fontSize: 15 },
  cardLater: { minHeight: 44, justifyContent: 'center' },
  cardLaterText: { color: schemeColor(AMBER_INK, 'fg'), fontWeight: '600', fontSize: 15 },
  sheet: { backgroundColor: colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 32, maxHeight: '90%' },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: schemeColor('rgba(0,0,0,0.15)', 'bg'), alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: schemeColor('#000000', 'fg'), marginBottom: 8 },
}))
