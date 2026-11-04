/**
 * The Loyalty Loop: shared design tokens.
 * Single source of truth for colours/fonts/shape language across
 * apps/web (Tailwind, mirrored in apps/web/src/index.css), apps/retailer, apps/shopper.
 *
 * 2026-11-04 palette 1 (owner's pick): Twilight Indigo #2B3A67 brand and CTA,
 * Blue Slate #496A81, Pacific Blue #66999B, Dry Sage #B3AF8F as quiet fields,
 * deep indigo ink on warm paper. Before that, the premium pass: warm paper (#F4F1EA) and near-black (#0E0E0F)
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
  foreground: '#1A2138',
  card: '#FFFFFF',
  primary: '#2B3A67',
  primaryHover: '#1F2A4D',
  accent: '#66999B',
  funGreen: '#178816',
  ink: '#1A2138',
  muted: '#6F6B64',
  destructive: '#DC2626',
  border: '#E2DDD3',

  olive: '#2B3A67',
  oliveInk: '#F4F1EA',
  sage: '#E3E1D2',
  sageInk: '#1A2138',
  peach: '#DCE7E7',
  peachInk: '#1A2138',
  amber: '#F2B544',
  amberInk: '#2A2410',
  orange: '#66999B',
  orangeInk: '#1A2138',
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
