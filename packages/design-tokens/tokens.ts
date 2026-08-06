/**
 * The Loyalty Loop — shared design tokens.
 * Single source of truth for colors/fonts/shape language across
 * apps/web (Tailwind), apps/owner-mobile, apps/consumer-mobile (NativeWind).
 * See docs/LOYALTY-LOOP-DESIGN-SYSTEM.md for the source spec.
 */

export const colors = {
  background: '#F9EDE2',
  foreground: '#40281C',
  card: '#FDF9F5',
  primary: '#EE5A2C',
  primaryGlow: '#F27B52',
  secondary: '#F0DCC0',
  accent: '#F6AF23',
  funGreen: '#30A66F',
  funViolet: '#9069D3',
  destructive: '#DC2626',
  border: '#E0C4A8',
} as const;

export const colorsHsl = {
  background: '30 65% 93%',
  foreground: '20 40% 18%',
  card: '30 60% 97%',
  primary: '16 85% 55%',
  primaryGlow: '16 90% 65%',
  secondary: '32 70% 88%',
  accent: '40 92% 55%',
  funGreen: '152 55% 42%',
  funViolet: '262 55% 62%',
  destructive: '0 72% 51%',
  border: '25 40% 82%',
} as const;

export const fonts = {
  display: 'Baloo 2',
  body: 'Quicksand',
} as const;

export const radius = {
  default: '1.25rem',
} as const;

export const shadow = {
  sticker: '3px 3px 0 0 hsl(20 40% 18% / 0.12)',
  stickerLifted: '6px 6px 0 0 hsl(20 40% 18% / 0.12)',
} as const;

export const borderWidth = {
  default: 3,
  thick: 4,
} as const;
