// Shopper app colours: the shared tokens with warmer surfaces (2026-10-18,
// owner asked for a warmer background). The website and business app keep the
// shared olive-tinted surfaces; only these values differ here.
import { colors as shared, fonts, radius } from '@loyalty-loop/design-tokens'

export const colors = {
  ...shared,
  background: '#E0CFB4', // warm sand (owner's pick), was #F3F4EF
  card: '#FFFBF5', // warm white, was #FCFCFA
  border: '#CDB896', // warm line, was #DCDFD6
  muted: '#474C45', // darker so secondary text stays readable on sand, was #5A635C
} as const

export { fonts, radius }
