/**
 * The Loyalty Loop — shared design tokens.
 * Single source of truth for colors/fonts/shape language across
 * apps/web (Tailwind), apps/retailer, apps/shopper.
 * See docs/LOYALTY-LOOP-DESIGN-SYSTEM.md for the source spec.
 */

export const colors = {
  background: '#F7ECDC',
  foreground: '#1a1a1a',
  card: '#FBF6EC',
  primary: '#E8703B',
  primaryHover: '#C9622E',
  accent: '#F6AF23',
  funGreen: '#3FA34D',
  ink: '#40281C',
  destructive: '#DC2626',
  border: '#ded6c9',
} as const;

export const fonts = {
  display: 'Libre Baskerville',
  body: 'DM Sans',
} as const;

export const radius = {
  default: '0.875rem',
} as const;

export const shadow = {
  sticker: '0 1px 2px rgb(26 26 26 / 0.06), 0 8px 24px rgb(26 26 26 / 0.05)',
  stickerLifted: '0 4px 8px rgb(26 26 26 / 0.08), 0 16px 32px rgb(26 26 26 / 0.08)',
} as const;

export const easing = {
  out: 'cubic-bezier(0.23, 1, 0.32, 1)',
  inOut: 'cubic-bezier(0.77, 0, 0.175, 1)',
} as const;
