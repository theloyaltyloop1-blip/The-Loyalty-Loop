/** Light and dark palettes. See tokens.ts for the overview. */

export const lightColors = {
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
  /** Body text. Black in light mode (owner request 2026-10-17), warm off-white in dark. */
  text: '#000000',
  /** Text and icons that sit on the brand colour (olive, primary buttons). */
  onPrimary: '#FFFFFF',
  /** Brand colour when it is used as text or a link on the page background. */
  primaryText: '#2B3A67',
  /** Quiet fills: chips, inputs, segmented controls. */
  fill: '#EFEBE3',
  /** Hairline rules and dividers. */
  hairline: 'rgba(26,33,56,0.12)',

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

/**
 * Dark palette (2026-11-15): warm near-black surfaces, Twilight Indigo lifted so
 * it still reads on dark, and the coloured tiles kept (deep tints of the same
 * hues, with amber and teal left bright). Every key matches lightColors.
 */
export const darkColors: Record<keyof typeof lightColors, string> = {
  background: '#131315',
  foreground: '#F2EFE8',
  card: '#1E1E22',
  primary: '#4F68C4',
  primaryHover: '#6A82D8',
  accent: '#7DB1B3',
  funGreen: '#5BD66A',
  ink: '#F2EFE8',
  muted: '#A8A39B',
  destructive: '#F26B6B',
  border: '#36363C',
  text: '#F2EFE8',
  onPrimary: '#FFFFFF',
  primaryText: '#9DB0F2',
  fill: '#2A2A30',
  hairline: 'rgba(255,255,255,0.12)',

  olive: '#34457F',
  oliveInk: '#F4F1EA',
  sage: '#2A3A36',
  sageInk: '#E3E1D2',
  peach: '#24393D',
  peachInk: '#DCE7E7',
  amber: '#F2B544',
  amberInk: '#2A2410',
  orange: '#7DB1B3',
  orangeInk: '#0F1A2E',
};

export type ColorScheme = 'light' | 'dark';
