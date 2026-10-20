// Dark premium theme (2026-10-20). Near-black surfaces, one vivid orange
// accent from the logo, soft white type. The shared tokens package stays as
// the website's light palette; both apps read their colours from here.
import { colors as base, fonts, radius } from '@loyalty-loop/design-tokens'

export const colors = {
  ...base,
  background: '#0A0B0A',
  foreground: '#F4F3EF',
  card: '#151716',
  raised: '#1E2120',
  input: '#1B1D1C',
  line: 'rgba(255,255,255,0.09)',
  primary: '#F2672A',
  primaryHover: '#FF7A3D',
  accent: '#FF8A4C',
  funGreen: '#4CC07A',
  ink: '#F4F3EF',
  muted: '#9DA49E',
  destructive: '#FF6B60',
  border: 'rgba(255,255,255,0.09)',
  olive: '#2A3A25',
  oliveInk: '#E3EDD9',
  sage: '#1A2418',
  sageInk: '#CFE0C4',
  peach: '#2E1C14',
  peachInk: '#F8C9B0',
  amber: '#F2B544',
  amberInk: '#2A2410',
  orange: '#F2672A',
  orangeInk: '#1A0C05',
} as const

export { fonts, radius }
