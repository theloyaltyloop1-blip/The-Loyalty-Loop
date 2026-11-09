// Maths for the Business app's map-pin picker. The app has no native map module,
// so the picker lays out ordinary map image tiles itself (standard "slippy map"
// tiles in Web Mercator). Everything here is pure so it can be unit tested.

export type LatLng = { lat: number; lng: number };
export type Point = { x: number; y: number };
export type Tile = { key: string; z: number; x: number; y: number; left: number; top: number };

/** On-screen size of one tile. Tiles are 256px images, so half-size keeps them sharp on phones. */
export const TILE_SIZE = 128;
export const MIN_ZOOM = 3;
export const MAX_ZOOM = 19;
/** A pin placed from further out than this could be streets away from the shop. */
export const MIN_PIN_ZOOM = 16;
const MAX_LAT = 85.0511;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function worldSize(zoom: number): number {
  return TILE_SIZE * 2 ** zoom;
}

export function toWorld({ lat, lng }: LatLng, zoom: number): Point {
  const size = worldSize(zoom);
  const sin = Math.sin((clamp(lat, -MAX_LAT, MAX_LAT) * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size,
  };
}

export function fromWorld({ x, y }: Point, zoom: number): LatLng {
  const size = worldSize(zoom);
  const wrappedX = ((x % size) + size) % size;
  const n = Math.PI - (2 * Math.PI * clamp(y, 0, size)) / size;
  return {
    lat: clamp((180 / Math.PI) * Math.atan(Math.sinh(n)), -MAX_LAT, MAX_LAT),
    lng: (wrappedX / size) * 360 - 180,
  };
}

/** Where the map centre ends up after the finger drags the map by (dx, dy). */
export function panned(center: LatLng, zoom: number, dx: number, dy: number): LatLng {
  const at = toWorld(center, zoom);
  return fromWorld({ x: at.x - dx, y: at.y - dy }, zoom);
}

/** The tiles that cover a width x height view centred on `center`, plus a ring to preload. */
export function tilesFor(center: LatLng, zoom: number, width: number, height: number, margin = 1): Tile[] {
  if (width <= 0 || height <= 0) return [];
  const at = toWorld(center, zoom);
  const count = 2 ** zoom;
  const originX = at.x - width / 2;
  const originY = at.y - height / 2;
  const firstX = Math.floor(originX / TILE_SIZE) - margin;
  const lastX = Math.floor((originX + width) / TILE_SIZE) + margin;
  const firstY = Math.max(0, Math.floor(originY / TILE_SIZE) - margin);
  const lastY = Math.min(count - 1, Math.floor((originY + height) / TILE_SIZE) + margin);
  const tiles: Tile[] = [];
  for (let ty = firstY; ty <= lastY; ty++) {
    for (let tx = firstX; tx <= lastX; tx++) {
      const x = ((tx % count) + count) % count;
      tiles.push({
        key: `${zoom}/${tx}/${ty}`,
        z: zoom,
        x,
        y: ty,
        left: Math.round(tx * TILE_SIZE - originX),
        top: Math.round(ty * TILE_SIZE - originY),
      });
    }
  }
  return tiles;
}

/** A usable shop position: real numbers, in range, and not the 0,0 a failed lookup leaves. */
export function validPin(lat?: number | null, lng?: number | null): LatLng | null {
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

/** Six decimal places is about 10cm: plenty for a shop door, and tidy in the database. */
export function roundPin({ lat, lng }: LatLng): LatLng {
  return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 };
}
