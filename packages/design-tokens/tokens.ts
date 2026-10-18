/**
 * The Loyalty Loop: shared design tokens.
 * Single source of truth for colours/fonts/shape language across
 * apps/web (Tailwind, mirrored in apps/web/src/index.css), apps/retailer, apps/shopper.
 *
 * 2026-10-04 redesign: neutral olive-tinted surfaces replace the old cream paper,
 * Bricolage Grotesque replaces the serif for display type, and the logo's orange
 * stays the only call-to-action colour. The colour fields (olive, sage, peach,
 * amber, orange) are for panels, tiles and highlights, each with a readable ink.
 */

export const colors = {
  background: '#F3F4EF',
  foreground: '#1C2620',
  card: '#FCFCFA',
  primary: '#C4531F',
  primaryHover: '#A8461A',
  accent: '#E8703B',
  funGreen: '#2F7A3F',
  ink: '#1C2620',
  muted: '#5A635C',
  destructive: '#DC2626',
  border: '#DCDFD6',

  olive: '#3E5235',
  oliveInk: '#F1F4EC',
  sage: '#DCE6D2',
  sageInk: '#24331F',
  peach: '#F8DCCB',
  peachInk: '#6E2C0F',
  amber: '#F2B544',
  amberInk: '#2A2410',
  orange: '#E8703B',
  orangeInk: '#2A1408',
} as const;

export const fonts = {
  display: 'Bricolage Grotesque',
  body: 'Geist',
  /** Loaded with expo-font in the native apps (see useBrandFonts in each app). */
  nativeDisplay: 'BricolageGrotesque_700Bold',
  nativeDisplaySemibold: 'BricolageGrotesque_600SemiBold',
} as const;

export const radius = {
  default: '0.75rem',
} as const;

export const shadow = {
  sticker: '0 1px 2px rgb(28 38 32 / 0.06), 0 6px 18px rgb(28 38 32 / 0.06)',
  stickerLifted: '0 4px 10px rgb(28 38 32 / 0.08), 0 18px 36px rgb(28 38 32 / 0.10)',
} as const;

export const easing = {
  out: 'cubic-bezier(0.23, 1, 0.32, 1)',
  inOut: 'cubic-bezier(0.77, 0, 0.175, 1)',
} as const;
