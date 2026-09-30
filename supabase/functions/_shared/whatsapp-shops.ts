// Finding and joining shops from a WhatsApp chat. Pure functions, so they
// run under Deno and in Node tests.

export type Shop = {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  lat: number | null;
  lng: number | null;
};

// "JOIN Pure Elegant", "join pure-elegant", "join shop 2"… Returns the text
// after the command, or null when this isn't a join command.
export function parseJoin(text: string): string | null {
  const match = /^join\s+(.{1,80})$/i.exec(text.trim());
  return match ? match[1].trim() : null;
}

// "shops near me", "shops near SW1A 1AA", "near LS1 4AP", "nearby".
// Returns { postcode } when one is given, "ask" when they need to share a
// location, or null when this isn't a nearby request.
export function parseNearby(text: string): { postcode: string } | "ask" | null {
  const t = text.trim();
  const postcode = /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i.exec(t);
  const asksNearby = /\b(near|nearby|close to|around)\b/i.test(t) && /\b(shops?|stores?|cafes?|places?|me|here|near|nearby)\b/i.test(t);
  if (!asksNearby && !/^nearby$/i.test(t)) return null;
  if (postcode) return { postcode: postcode[1].toUpperCase().replace(/\s+/g, "").replace(/(\w{3})$/, " $1") };
  return "ask";
}

const normalise = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Exact slug or name wins; otherwise every shop whose name contains all the
// words typed, best (shortest) names first.
export function matchShops(query: string, shops: Shop[]): Shop[] {
  const q = normalise(query);
  if (!q) return [];
  const exact = shops.filter((s) => s.slug.toLowerCase() === query.trim().toLowerCase() || normalise(s.name) === q);
  if (exact.length) return exact.slice(0, 1);
  const words = q.split(" ");
  return shops
    .filter((s) => { const name = normalise(s.name); return words.every((w) => name.includes(w)); })
    .sort((a, b) => a.name.length - b.name.length)
    .slice(0, 5);
}

export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat), dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export function nearestShops(lat: number, lng: number, shops: Shop[], limit = 5, maxKm = 25) {
  return shops
    .filter((s): s is Shop & { lat: number; lng: number } => typeof s.lat === "number" && typeof s.lng === "number")
    .map((s) => ({ shop: s, km: distanceKm(lat, lng, s.lat, s.lng) }))
    .filter((x) => x.km <= maxKm)
    .sort((a, b) => a.km - b.km)
    .slice(0, limit);
}

function distanceText(km: number) {
  const miles = km * 0.621371;
  return miles < 0.1 ? "right by you" : `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} miles`;
}

export function nearbyReply(found: Array<{ shop: Shop; km: number }>, joinedIds: Set<string>): string {
  if (!found.length) return "There aren't any Loyalty Loop shops near there yet. Try a different postcode, or check back soon!";
  const lines = found.map(({ shop, km }) =>
    `• ${shop.name}${shop.category ? ` (${shop.category})` : ""} — ${distanceText(km)}${joinedIds.has(shop.id) ? " ✓ joined" : `\n  Reply: JOIN ${shop.slug}`}`);
  return `Loyalty Loop shops near you:\n${lines.join("\n")}`;
}

export const ASK_LOCATION =
  "Share your location and I'll find Loyalty Loop shops near you: tap 📎 (or +) → Location → Send your current location. Or type a postcode, like \"shops near SW1A 1AA\".";

export function joinChoices(matches: Shop[]): string {
  return `I found a few shops matching that:\n${matches.map((s) => `• ${s.name} — reply: JOIN ${s.slug}`).join("\n")}`;
}

export const NO_SHOP_FOUND =
  "I couldn't find a Loyalty Loop shop with that name. Check the spelling, or send \"shops near me\" to see what's close by.";
