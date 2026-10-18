// Shops type their address in any case ("9 drakefield road, sw17 8rr").
// Show street words in Title Case and UK postcodes in capitals.
const POSTCODE = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/gi;
const SMALL = new Set(["of", "the", "and", "on", "upon", "in"]);

export function formatAddress(address: string | null | undefined): string {
  if (!address) return "";
  const cased = address
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word, i) => {
      const lower = word.toLowerCase();
      if (i > 0 && SMALL.has(lower)) return lower;
      return lower.replace(/(^|[-(])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase());
    })
    .join(" ");
  return cased.replace(POSTCODE, (_, out: string, inward: string) => `${out.toUpperCase()} ${inward.toUpperCase()}`);
}
