// Smooth (continuous, "squircle") corners on iPhone, app-wide. Keep identical
// in apps/shopper and apps/retailer, and import it FIRST in index.ts so it runs
// before any StyleSheet.create.
//
// Every style with a corner radius gets borderCurve: 'continuous' (iOS only;
// Android ignores it). Circles and pills are left alone: a continuous curve
// would make them slightly squarish.
import { Platform, StyleSheet } from 'react-native'

type Style = Record<string, unknown>

function isRoundShape(style: Style, radius: number): boolean {
  if (radius >= 999) return true
  const sizes = [style.width, style.height, style.minHeight].filter((v): v is number => typeof v === 'number')
  return sizes.some((size) => radius * 2 >= size - 1)
}

function smooth(style: unknown): unknown {
  if (!style || typeof style !== 'object' || Array.isArray(style)) return style
  const s = style as Style
  const radius = s.borderRadius
  if (typeof radius !== 'number' || radius <= 0 || 'borderCurve' in s) return style
  if (isRoundShape(s, radius)) return style
  return { ...s, borderCurve: 'continuous' }
}

if (Platform.OS === 'ios') {
  try {
    const sheet = StyleSheet as unknown as { create: (styles: Record<string, unknown>) => unknown }
    const original = sheet.create.bind(StyleSheet)
    sheet.create = (styles) => {
      const out: Record<string, unknown> = {}
      for (const key of Object.keys(styles)) out[key] = smooth(styles[key])
      return original(out)
    }
  } catch {
    // StyleSheet not patchable on this runtime: square-ish corners as before.
  }
}

export {}
