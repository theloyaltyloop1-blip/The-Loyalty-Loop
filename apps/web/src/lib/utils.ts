export { cn } from "cn"

/** Text colour that stays readable on a shop's brand colour (WCAG relative luminance). */
export function onBrandColor(hex: string | null | undefined): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? '')
  if (!m) return '#ffffff'
  const n = parseInt(m[1], 16)
  const lin = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  const L = 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 0xff) + 0.0722 * lin(n & 0xff)
  // White wins when it gives more contrast than near-black ink.
  return 1.05 / (L + 0.05) >= (L + 0.05) / (0.0137 + 0.05) ? '#ffffff' : '#1C2620'
}
