// Pure money and country helpers (no native imports, so node tests can load them).
// Countries the platform runs in. The rows come from the `countries` table so
// the rules can change without an app update; FALLBACK covers the first load
// and offline starts.
export type Country = {
  code: string
  name: string
  currency_code: string
  currency_symbol: string
  display_decimals: number
  card_linking: boolean
  // Spend limits are written for pounds and multiplied by this (PKR: 300).
  amount_scale: number
}

export const FALLBACK_COUNTRIES: Country[] = [
  { code: 'GB', name: 'United Kingdom', currency_code: 'GBP', currency_symbol: '£', display_decimals: 2, card_linking: true, amount_scale: 1 },
  { code: 'PK', name: 'Pakistan', currency_code: 'PKR', currency_symbol: 'Rs', display_decimals: 0, card_linking: false, amount_scale: 300 },
]

export const DEFAULT_COUNTRY = 'GB'

export function findCountry(countries: Country[], code: string | null | undefined): Country {
  return (
    countries.find((country) => country.code === code) ??
    FALLBACK_COUNTRIES.find((country) => country.code === code) ??
    FALLBACK_COUNTRIES[0]
  )
}

/** Formats an amount stored in minor units (pence, paisa), e.g. "£4.50" or "Rs 450". */
export function formatMoney(minor: number, country: Country): string {
  const major = minor / 100
  const amount = major.toLocaleString('en-GB', {
    minimumFractionDigits: country.display_decimals,
    maximumFractionDigits: country.display_decimals,
  })
  return country.currency_symbol.length > 1 ? `${country.currency_symbol} ${amount}` : `${country.currency_symbol}${amount}`
}

/** A formatter for one shop's currency, from its country code. */
export function shopMoney(code: string | null | undefined): (minor: number) => string {
  const country = findCountry([], code)
  return (minor) => formatMoney(minor, country)
}

// The Business app shows one shop at a time, so money follows that shop's
// country. setActiveCountry runs whenever the open shop changes.
let active: Country = FALLBACK_COUNTRIES[0]

export function setActiveCountry(code: string | null | undefined) {
  active = findCountry([], code)
}

/** The open shop's currency, e.g. "£4.50" or "Rs 450". */
export const money = (minor: number) => formatMoney(minor, active)

/** The open shop's currency symbol, for labels such as "Amount (£)". */
export const currencySymbol = () => active.currency_symbol

/** Scales a limit written in pence to the open shop's currency. */
export const scaledLimit = (pence: number) => pence * active.amount_scale
