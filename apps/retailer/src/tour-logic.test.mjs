import assert from "node:assert/strict";
import test from "node:test";
import {
  TOUR_STOPS,
  calloutPlacement,
  nextStop,
  rectIsUsable,
  remainingOnScreen,
  tourCopy,
  tourSeenKey,
} from "./tour-logic.ts";

const all = new Set(TOUR_STOPS.map((s) => s.target));

test("seen keys are per shop and per stop, and SecureStore-safe", () => {
  const a = tourSeenKey("11111111-2222-3333-4444-555555555555", "scan-input");
  const b = tourSeenKey("99999999-2222-3333-4444-555555555555", "scan-input");
  const c = tourSeenKey("11111111-2222-3333-4444-555555555555", "scan-result");
  assert.equal(a, "tour_seen_11111111222233334444555555555555_scan_input");
  assert.notEqual(a, b);
  assert.notEqual(a, c);
  assert.match(a, /^[A-Za-z0-9._-]+$/);
});

test("Home shows the Scan tab stop first, once", () => {
  assert.equal(nextStop({ screen: "home", seen: new Set(), registered: all })?.id, "home-scan-tab");
  assert.equal(nextStop({ screen: "home", seen: new Set(["home-scan-tab"]), registered: all }), null);
});

test("stops only show on their own screen, in script order", () => {
  assert.equal(nextStop({ screen: "scan", seen: new Set(), registered: all })?.id, "scan-input");
  assert.equal(nextStop({ screen: "scan", seen: new Set(["scan-input"]), registered: all })?.id, "scan-result");
  assert.equal(nextStop({ screen: "settings", seen: new Set(), registered: all })?.id, "shop-programme");
  assert.equal(nextStop({ screen: null, seen: new Set(), registered: all }), null);
});

test("a stop whose target is not registered is skipped silently", () => {
  const noTiles = new Set(["tab-scan", "scan-input"]);
  assert.equal(nextStop({ screen: "settings", seen: new Set(), registered: noTiles }), null);
  // scan result target only exists after a scan
  assert.equal(nextStop({ screen: "scan", seen: new Set(["scan-input"]), registered: noTiles }), null);
  const withPoster = new Set(["tour-poster-tile"]);
  assert.equal(nextStop({ screen: "settings", seen: new Set(), registered: withPoster })?.id, "shop-poster");
});

test("stops that failed to measure are not retried on the same visit", () => {
  const skipped = new Set(["scan-input"]);
  assert.equal(nextStop({ screen: "scan", seen: new Set(), registered: all, skipped })?.id, "scan-result");
});

test("copy follows the programme", () => {
  assert.equal(tourCopy("home-scan-tab"), "Open Scan when a customer pays.");
  assert.equal(tourCopy("scan-input"), "Scan their QR, or type their code.");
  assert.equal(tourCopy("scan-result", "stamps"), "Tap once to add a stamp.");
  assert.equal(tourCopy("scan-result", "spend"), "Enter what they spent.");
  assert.equal(tourCopy("scan-result", "tiers"), "Their level and perks show here.");
  assert.equal(tourCopy("scan-result", "points"), "Their points balance shows here.");
  assert.equal(tourCopy("scan-result"), "Tap once to add a stamp.");
  assert.equal(tourCopy("shop-poster"), "Print this so customers can join.");
});

test("remainingOnScreen counts unseen stops for the button label", () => {
  assert.equal(remainingOnScreen("scan", new Set()).length, 2);
  assert.equal(remainingOnScreen("scan", new Set(["scan-input"])).length, 1);
});

test("rectIsUsable rejects off-screen, tiny and NaN rects", () => {
  const vp = { width: 400, height: 800 };
  assert.equal(rectIsUsable({ x: 10, y: 10, width: 100, height: 40 }, vp), true);
  assert.equal(rectIsUsable({ x: 10, y: 900, width: 100, height: 40 }, vp), false);
  assert.equal(rectIsUsable({ x: -200, y: 10, width: 100, height: 40 }, vp), false);
  assert.equal(rectIsUsable({ x: 10, y: 10, width: 0, height: 0 }, vp), false);
  assert.equal(rectIsUsable({ x: NaN, y: 10, width: 10, height: 10 }, vp), false);
});

test("callout sits below top targets and above bottom ones", () => {
  assert.equal(calloutPlacement({ x: 0, y: 100, width: 50, height: 50 }, 800), "below");
  assert.equal(calloutPlacement({ x: 0, y: 700, width: 50, height: 50 }, 800), "above");
});
