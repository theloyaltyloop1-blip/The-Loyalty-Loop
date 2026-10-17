import { toSVG } from 'bwip-js/generic'

export const FORMATS = ['ean13', 'ean8', 'code128', 'code39', 'qr', 'pdf417', 'itf14', 'upc_a'] as const
export type BarcodeFormat = typeof FORMATS[number]
export const BRANDS = [
  ['nectar', 'Nectar'], ['tesco', 'Tesco Clubcard'], ['boots', 'Boots Advantage'],
  ['morrisons', 'Morrisons More'], ['superdrug', 'Superdrug Health & Beautycard'],
  ['waitrose', 'Waitrose myWaitrose'], ['ikea', 'IKEA Family'], ['other', 'Other card'],
] as const

// Evidence and variant limits: docs/CARD_WALLET_FORMAT_EVIDENCE.md.
// Defaults are suggestions for typed entry, never a conversion of card data.
export const BRAND_DEFAULT_FORMATS: Partial<Record<typeof BRANDS[number][0], BarcodeFormat>> = {
  nectar: 'code128',
}
export function brandFormatChoice(brand: string): { format: BarcodeFormat; showPicker: boolean } {
  const confirmed = BRAND_DEFAULT_FORMATS[brand as typeof BRANDS[number][0]]
  return { format: confirmed ?? 'code128', showPicker: !confirmed }
}

export function checkedNumber(input: string, format: BarcodeFormat): string {
  const value = input.replace(/\s/g, '')
  if (value.length < 4 || value.length > 64 || /[^\x21-\x7e]/.test(value)) throw new Error('Use 4 to 64 printable characters.')
  const length = { ean13: 13, ean8: 8, upc_a: 12, itf14: 14 }[format as 'ean13' | 'ean8' | 'upc_a' | 'itf14']
  if (length) {
    if (!/^\d+$/.test(value) || value.length !== length) throw new Error(`This format needs ${length} digits.`)
    let sum = 0
    for (let i = value.length - 2, weight = 3; i >= 0; i--, weight = 4 - weight) sum += Number(value[i]) * weight
    if ((10 - sum % 10) % 10 !== Number(value.at(-1))) throw new Error('The check digit does not match. Check the number or format.')
  }
  if (format === 'code39' && !/^[0-9A-Z.\-$/+%]+$/.test(value)) throw new Error('Code 39 needs uppercase letters, digits or its supported punctuation.')
  return value
}

export function barcodeSvg(input: string, format: BarcodeFormat): string {
  const text = checkedNumber(input, format)
  try {
    return toSVG({ bcid: format === 'qr' ? 'qrcode' : format === 'upc_a' ? 'upca' : format,
      text, scale: 3, height: 22, paddingwidth: 12, paddingheight: 12, backgroundcolor: 'FFFFFF', barcolor: '000000', includetext: false })
  } catch {
    // Encoder exceptions can contain the input. Never expose or report them.
    throw new Error('This number cannot be drawn in that barcode format.')
  }
}
