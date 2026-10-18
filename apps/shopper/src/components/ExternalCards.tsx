import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native'
import { SvgXml } from 'react-native-svg'
import { requireOptionalNativeModule } from 'expo-modules-core'
import { colors, fonts } from '../theme'
import { supabase } from '../supabase'
import { externalCardCache, type Card } from '../external-cards'
import { barcodeSvg, brandFormatChoice, BRANDS, checkedNumber, FORMATS, type BarcodeFormat } from '../external-card-barcode'

// No camera import: current store-build camera linkage/permission is unproven.
// Typed entry remains available without changing the native binary.
export function ExternalCards({ userId }: { userId: string }) {
  const [cards, setCards] = useState<Card[]>([])
  const [selected, setSelected] = useState<Card | null>(null)
  const [adding, setAdding] = useState(false)
  const [brand, setBrand] = useState('nectar')
  const [label, setLabel] = useState('Nectar')
  const [number, setNumber] = useState('')
  const [format, setFormat] = useState<BarcodeFormat>(brandFormatChoice('nectar').format)
  const [showFormatPicker, setShowFormatPicker] = useState(brandFormatChoice('nectar').showPicker)
  const [message, setMessage] = useState('Loading saved cards…')
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const alive = useRef(true)
  const { width } = useWindowDimensions()
  function chooseBrand(key: string, name: string) {
    const choice = brandFormatChoice(key)
    setBrand(key); setLabel(name); setFormat(choice.format); setShowFormatPicker(choice.showPicker)
  }
  useEffect(() => {
    if (!selected || !requireOptionalNativeModule('ExpoKeepAwake')) return
    // Guard before requiring: old store binaries must never load a missing module.
    const awake = require('expo-keep-awake') as typeof import('expo-keep-awake')
    let cancelled = false
    void awake.activateKeepAwakeAsync('external-card').then(() => {
      if (cancelled) void awake.deactivateKeepAwake('external-card').catch(() => undefined)
    }).catch(() => undefined)
    return () => { cancelled = true; void awake.deactivateKeepAwake('external-card').catch(() => undefined) }
  }, [selected?.id])
  useEffect(() => {
    alive.current = true
    let cancelled = false
    void (async () => {
      try {
        const cached = await externalCardCache.read(userId)
        if (cancelled) return
        setCards(cached); setMessage('Checking for changes…')
        const { data, error } = await supabase.from('shopper_external_cards').select('id,user_id,brand_key,label,card_number,barcode_format,created_at,updated_at').eq('user_id', userId).order('created_at')
        if (cancelled) return
        if (error) { setMessage('Could not refresh. Saved cards are still available. Connect to add or change cards.'); return }
        setCards(data as Card[]); setMessage('')
        try { await externalCardCache.write(userId, data as Card[]) } catch { if (!cancelled) setMessage('Cards loaded, but offline saving failed. Try opening this wallet again.') }
      } catch { if (!cancelled) setMessage('Could not load saved cards. Try opening this wallet again.') }
      finally { if (!cancelled) setLoaded(true) }
    })()
    return () => { cancelled = true; alive.current = false }
  }, [userId])

  const drawing = useMemo(() => {
    if (!selected) return null
    try { return barcodeSvg(selected.card_number, selected.barcode_format) } catch { return null }
  }, [selected])

  async function persist(next: Card[]) {
    if (!alive.current) return
    setCards(next)
    try { await externalCardCache.write(userId, next) }
    catch { if (alive.current) setMessage('Saved online, but offline saving failed. Open the wallet again while connected.') }
  }
  async function save() {
    if (busy) return
    if (!label.trim() || label.trim().length > 40) { setMessage('Give your card a name of 1 to 40 characters.'); return }
    let value = ''
    if (!selected) {
      try { value = checkedNumber(number, format); barcodeSvg(value, format) }
      catch (error) { setMessage(error instanceof Error ? error.message : 'Check the number and format.'); return }
    }
    setBusy(true); setMessage('')
    try {
      if (selected) {
        const { data, error } = await supabase.from('shopper_external_cards').update({ label: label.trim() }).eq('id', selected.id).eq('user_id', userId).select().single()
        if (error) throw new Error()
        if (!alive.current) return
        setSelected(data as Card); await persist(cards.map(card => card.id === selected.id ? data as Card : card))
      } else {
        const { data, error } = await supabase.from('shopper_external_cards').insert({ user_id: userId, brand_key: brand, label: label.trim(), card_number: value, barcode_format: format }).select().single()
        if (error) { setMessage(error.code === '23505' ? 'That card is already in your wallet.' : 'Could not save. Check your connection and the 30-card limit.'); return }
        if (!alive.current) return
        await persist([...cards, data as Card]); setSelected(data as Card); setAdding(false); setNumber('')
      }
    } catch { if (alive.current) setMessage('Could not save. Check your connection and try again.') }
    finally { if (alive.current) setBusy(false) }
  }
  function confirmDelete() {
    const target = selected
    if (!target) return
    Alert.alert('Delete this card?', 'This removes it from your wallet and this device. It does not close your account with the shop.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete card', style: 'destructive', onPress: () => { void (async () => {
        setBusy(true); setMessage('')
        try {
          const { error } = await supabase.from('shopper_external_cards').delete().eq('id', target.id).eq('user_id', userId)
          if (error) throw new Error()
          if (!alive.current) return
          await persist(cards.filter(card => card.id !== target.id)); setSelected(null)
        } catch { if (alive.current) setMessage('Could not delete. Connect and try again.') }
        finally { if (alive.current) setBusy(false) }
      })() } },
    ])
  }
  const action = (title: string, onPress: () => void, disabled = busy) => <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[s.action, disabled && { opacity: 0.5 }]}><Text style={s.actionText}>{title}</Text></Pressable>
  return <View style={{ gap: 16 }}>
    <Text style={s.copy}>Keep your other loyalty cards here and show them at the till.</Text>
    {!!message && <Text accessibilityLiveRegion="polite" style={s.copy}>{message}</Text>}
    {selected ? <>
      {action('Back to my cards', () => { setSelected(null); setMessage('') })}
      <Text style={s.heading}>Show your {selected.label} card here</Text>
      <ScrollView horizontal contentContainerStyle={{ minWidth: width - 40, alignItems: 'center', backgroundColor: '#fff', padding: 12 }}>
        {drawing ? <SvgXml xml={drawing} width={Math.max(200, width - 64)} height={170} /> : <Text style={s.copy}>Barcode unavailable. Use the number below.</Text>}
      </ScrollView>
      <Text selectable style={[s.copy, { textAlign: 'center', fontSize: 20 }]}>{selected.card_number}</Text>
      <Text style={s.copy}>Card name</Text>
      <TextInput accessibilityLabel="Card name" value={label} onChangeText={setLabel} maxLength={40} style={s.input} />
      {action(busy ? 'Saving…' : 'Save name', () => void save())}
      {action('Delete card', confirmDelete)}
    </> : adding ? <>
      {action('Back to my cards', () => { setAdding(false); setNumber(''); setMessage('') })}
      <Text style={s.heading}>Add a card</Text>
      <Text style={s.copy}>Choose the shop</Text>
      <View style={s.wrap}>{BRANDS.map(([key, name]) => <Pressable accessibilityRole="button" accessibilityState={{ selected: brand === key }} key={key} onPress={() => chooseBrand(key, name)} style={[s.choice, brand === key && s.chosen]}><Text style={s.copy}>{name}</Text></Pressable>)}</View>
      <Text style={s.copy}>Card name</Text><TextInput accessibilityLabel="Card name" value={label} onChangeText={setLabel} maxLength={40} style={s.input} />
      <Text style={s.copy}>Barcode format: {format.toUpperCase().replace('_', '-')}</Text>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: showFormatPicker }} onPress={() => setShowFormatPicker(value => !value)} style={s.choice}><Text style={s.copy}>Change format</Text></Pressable>
      {showFormatPicker && <><Text style={s.copy}>Match the format on your original card.</Text><View style={s.wrap}>{FORMATS.map(item => <Pressable accessibilityRole="button" accessibilityState={{ selected: item === format }} key={item} onPress={() => setFormat(item)} style={[s.choice, item === format && s.chosen]}><Text style={s.copy}>{item.toUpperCase().replace('_', '-')}</Text></Pressable>)}</View></>}
      <Text style={s.copy}>Card number</Text><TextInput accessibilityLabel="Card number" value={number} onChangeText={setNumber} autoCapitalize="none" autoCorrect={false} maxLength={128} style={s.input} placeholder="Type the number below the barcode" placeholderTextColor="#000" />
      <Text style={s.copy}>Some offers still need switching on in the shop's own app.</Text>
      {action(busy ? 'Saving…' : 'Save card', () => void save())}
    </> : <>
      {!cards.length && loaded && <Text style={s.heading}>Your other cards, ready at the till.</Text>}
      {cards.map((card, index) => <Pressable accessibilityRole="button" key={card.id} onPress={() => { setSelected(card); setLabel(card.label); setMessage('') }} style={[s.card, { backgroundColor: index % 2 ? '#E9C6AE' : '#D5DFBB' }]}><Text style={s.heading}>{card.label}</Text><Text style={s.copy}>Show card</Text></Pressable>)}
      {action(cards.length >= 30 ? '30 cards saved' : 'Add a card', () => { setAdding(true); chooseBrand('nectar', 'Nectar'); setMessage('') }, busy || !loaded || cards.length >= 30)}
    </>}
  </View>
}
const s = StyleSheet.create({
  copy: { color: '#000', fontSize: 15, lineHeight: 22 }, heading: { color: '#000', fontFamily: fonts.nativeDisplay, fontSize: 23 },
  card: { padding: 22, borderRadius: 20, gap: 18 }, input: { color: '#000', fontSize: 17, padding: 14, borderWidth: 1, borderColor: '#68705E', borderRadius: 12, backgroundColor: '#fff' },
  action: { padding: 15, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', minHeight: 48 }, actionText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, choice: { padding: 12, borderRadius: 18, borderWidth: 1, borderColor: '#68705E', minHeight: 44 }, chosen: { backgroundColor: '#D5DFBB', borderWidth: 2 },
})
