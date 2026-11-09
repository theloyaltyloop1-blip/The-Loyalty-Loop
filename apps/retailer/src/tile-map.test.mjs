import assert from "node:assert/strict";
import test from "node:test";
import { TILE_SIZE, fromWorld, panned, roundPin, tilesFor, toWorld, validPin, worldSize } from "./tile-map.ts";

const near = (a, b, tolerance = 1e-6) => assert.ok(Math.abs(a - b) < tolerance, `${a} is not close to ${b}`);

test("the middle of the world is the middle of the map", () => {
  const at = toWorld({ lat: 0, lng: 0 }, 4);
  near(at.x, worldSize(4) / 2);
  near(at.y, worldSize(4) / 2);
});

test("a position survives the round trip to map pixels and back", () => {
  for (const place of [{ lat: 51.5074, lng: -0.1278 }, { lat: 24.8607, lng: 67.0011 }, { lat: -33.8688, lng: 151.2093 }]) {
    const back = fromWorld(toWorld(place, 17), 17);
    near(back.lat, place.lat);
    near(back.lng, place.lng);
  }
});

test("dragging the map right moves the centre west, dragging down moves it north", () => {
  const start = { lat: 53.48, lng: -2.24 };
  const moved = panned(start, 16, 100, 100);
  assert.ok(moved.lng < start.lng);
  assert.ok(moved.lat > start.lat);
  const back = panned(moved, 16, -100, -100);
  near(back.lat, start.lat);
  near(back.lng, start.lng);
});

test("tiles cover the whole view and line up edge to edge", () => {
  const width = 390, height = 420;
  const tiles = tilesFor({ lat: 51.5074, lng: -0.1278 }, 17, width, height, 0);
  assert.ok(Math.min(...tiles.map((t) => t.left)) <= 0);
  assert.ok(Math.min(...tiles.map((t) => t.top)) <= 0);
  assert.ok(Math.max(...tiles.map((t) => t.left)) + TILE_SIZE >= width);
  assert.ok(Math.max(...tiles.map((t) => t.top)) + TILE_SIZE >= height);
  const lefts = [...new Set(tiles.map((t) => t.left))].sort((a, b) => a - b);
  for (let i = 1; i < lefts.length; i++) assert.equal(lefts[i] - lefts[i - 1], TILE_SIZE);
  assert.equal(new Set(tiles.map((t) => t.key)).size, tiles.length);
});

test("the centre of the view falls inside the centre tile", () => {
  const center = { lat: 51.5074, lng: -0.1278 };
  const tiles = tilesFor(center, 17, 400, 400, 0);
  const at = toWorld(center, 17);
  const expected = { x: Math.floor(at.x / TILE_SIZE), y: Math.floor(at.y / TILE_SIZE) };
  const hit = tiles.find((t) => t.left <= 200 && t.left + TILE_SIZE > 200 && t.top <= 200 && t.top + TILE_SIZE > 200);
  assert.deepEqual({ x: hit.x, y: hit.y }, expected);
});

test("tiles wrap around the date line and never run off the top or bottom", () => {
  const tiles = tilesFor({ lat: 80, lng: 179.9 }, 3, 600, 600);
  for (const tile of tiles) {
    assert.ok(tile.x >= 0 && tile.x < 8);
    assert.ok(tile.y >= 0 && tile.y < 8);
  }
  assert.deepEqual(tilesFor({ lat: 0, lng: 0 }, 5, 0, 0), []);
});

test("only real positions count as a pin", () => {
  assert.equal(validPin(null, null), null);
  assert.equal(validPin(0, 0), null);
  assert.equal(validPin(91, 0), null);
  assert.equal(validPin(Number.NaN, 1), null);
  assert.deepEqual(validPin(51.5, -0.12), { lat: 51.5, lng: -0.12 });
  assert.deepEqual(roundPin({ lat: 51.50740012345, lng: -0.12780098765 }), { lat: 51.5074, lng: -0.127801 });
});
