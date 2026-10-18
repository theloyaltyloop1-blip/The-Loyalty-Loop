import { requireOptionalNativeModule } from 'expo-modules-core'
import { DEFAULT_COUNTRY } from './money'

export * from './money'

// Time zones are read by the JavaScript engine itself, so this works in every
// build, including ones without the localisation native module.
const TIME_ZONE_COUNTRY: Record<string, string> = {
  'Asia/Karachi': 'PK',
  'Europe/London': 'GB',
  'Europe/Belfast': 'GB',
}

function phoneRegion(): string | null {
  // Same rule as use-user-location.ts: JavaScript reaches older builds as an
  // over-the-air update, and a try/catch around require() does not stop a
  // missing native module from crashing the app. Check the module first.
  if (!requireOptionalNativeModule('ExpoLocalization')) return null
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const localization = require('expo-localization') as typeof import('expo-localization')
    return localization.getLocales()[0]?.regionCode?.toUpperCase() ?? null
  } catch {
    return null
  }
}

function timeZoneCountry(): string | null {
  try {
    return TIME_ZONE_COUNTRY[Intl.DateTimeFormat().resolvedOptions().timeZone] ?? null
  } catch {
    return null
  }
}

/** Best guess of where the phone is, limited to countries we run in. The user confirms it. */
export function guessCountry(supported: string[]): string {
  // The time zone follows where the phone actually is; the region setting is
  // often left on a default, so it only breaks a tie.
  for (const code of [timeZoneCountry(), phoneRegion()]) {
    if (code && supported.includes(code)) return code
  }
  return DEFAULT_COUNTRY
}
