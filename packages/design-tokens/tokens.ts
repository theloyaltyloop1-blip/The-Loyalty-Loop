/**
 * The Loyalty Loop: shared design tokens.
 * Single source of truth for colours/fonts/shape language across
 * apps/web (Tailwind, mirrored in apps/web/src/index.css), apps/retailer, apps/shopper.
 *
 * 2026-11-04 premium pass: warm paper (#F4F1EA) and near-black (#0E0E0F)
 * surfaces with ink type; Sapphire #0042AC stays the one call-to-action colour.
 * Earlier (2026-11-03) Sapphire look, from the owner's reference videos: Sapphire Blue
 * #0042AC is the call-to-action colour, Ocean Blue #00D3FB the bright accent,
 * Neon Jade #83FD80 the highlight, on cool cloudy-white surfaces with navy ink.
 * One clean grotesk (Inter) for display and body. The field names (olive, sage,
 * peach, amber, orange) are kept so screens don't change; they now hold the
 * blue/ocean/jade panels, each with a readable ink.
 */

export const colors = {
  background: '#F4F1EA',
  foreground: '#111111',
  card: '#FFFFFF',
  primary: '#0042AC',
  primaryHover: '#00358A',
  accent: '#8FB4FA',
  funGreen: '#178816',
  ink: '#111111',
  muted: '#6F6B64',
  destructive: '#DC2626',
  border: '#E2DDD3',

  olive: '#0E0E0F',
  oliveInk: '#F4F1EA',
  sage: '#E7E2D8',
  sageInk: '#111111',
  peach: '#DBE7FF',
  peachInk: '#04183D',
  amber: '#F2B544',
  amberInk: '#2A2410',
  orange: '#8FB4FA',
  orangeInk: '#04183D',
} as const;

export const fonts = {
  display: 'Inter',
  body: 'Inter',
  /** Loaded with expo-font in the native apps (see useFonts in each App.tsx). */
  nativeDisplay: 'Inter_700Bold',
  nativeDisplaySemibold: 'Inter_600SemiBold',
} as const;

export const radius = {
  default: '0.75rem',
} as const;

export const shadow = {
  sticker: '0 1px 2px rgb(15 28 51 / 0.06), 0 6px 18px rgb(15 28 51 / 0.06)',
  stickerLifted: '0 4px 10px rgb(15 28 51 / 0.08), 0 18px 36px rgb(15 28 51 / 0.10)',
} as const;

export const easing = {
  out: 'cubic-bezier(0.23, 1, 0.32, 1)',
  inOut: 'cubic-bezier(0.77, 0, 0.175, 1)',
} as const;
