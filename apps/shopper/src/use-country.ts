import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert } from 'react-native'
import { supabase } from './supabase'
import { FALLBACK_COUNTRIES, findCountry, guessCountry, type Country } from './country'

// The shopper's country: guessed from the phone, confirmed once, then saved on
// their profile so it stays put when they travel or use a VPN.
export function useCountry(userId: string | null) {
  const [countries, setCountries] = useState<Country[]>(FALLBACK_COUNTRIES)
  const [code, setCode] = useState<string | null>(null)
  const asked = useRef(false)

  const save = useCallback(async (next: string) => {
    setCode(next)
    if (!userId) return
    const { error } = await supabase.from('profiles').update({ country_code: next }).eq('id', userId)
    if (error) console.warn('Could not save country', error.message)
  }, [userId])

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void (async () => {
      const [list, profile] = await Promise.all([
        supabase.from('countries').select('code,name,currency_code,currency_symbol,display_decimals,card_linking,amount_scale').eq('is_active', true),
        supabase.from('profiles').select('country_code').eq('id', userId).single(),
      ])
      if (cancelled) return
      const available = list.error || !list.data?.length ? FALLBACK_COUNTRIES : (list.data as Country[])
      setCountries(available)
      const saved = profile.error ? null : (profile.data?.country_code as string | null)
      if (saved) {
        setCode(saved)
        return
      }
      // Older app versions before this column existed: keep everyone working
      // with the guess, and only ask when the profile row loaded fine.
      const guess = guessCountry(available.map((country) => country.code))
      setCode(guess)
      if (profile.error || asked.current) return
      asked.current = true
      const guessed = findCountry(available, guess)
      const others = available.filter((country) => country.code !== guess)
      Alert.alert(
        `Are you in ${guessed.name === 'United Kingdom' ? 'the UK' : guessed.name}?`,
        'We use this to show shops near you and prices in your currency. You can change it later in Settings.',
        [
          ...others.map((country) => ({ text: `No, ${country.name}`, onPress: () => void save(country.code) })),
          { text: 'Yes', style: 'default' as const, onPress: () => void save(guess) },
        ],
        { cancelable: false },
      )
    })()
    return () => {
      cancelled = true
    }
  }, [userId, save])

  return { country: findCountry(countries, code), countries, ready: code !== null, setCountry: save }
}
