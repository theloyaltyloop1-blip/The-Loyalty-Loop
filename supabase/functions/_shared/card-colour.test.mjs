import assert from "node:assert/strict";
import { test } from "node:test";
import { contrast, dominantColour, finalise, isHex, parseAiColour, readableText } from "./card-colour.ts";

test("parseAiColour accepts only valid hex and returns readable output", () => {
  const c = parseAiColour('Sure: {"background":"#C0392B","secondary":"#F5E6C8"}');
  assert.ok(c && isHex(c.background) && isHex(c.secondary));
  assert.ok(contrast(c.background, c.text) >= 4.5);
  assert.equal(parseAiColour('{"background":"red"}'), null);
  assert.equal(parseAiColour('{"background":"url(x)"}'), null);
  assert.equal(parseAiColour("no json"), null);
});
test("finalise fixes mid, white and black backgrounds", () => {
  for (const bg of ["#808080", "#FFFFFF", "#000000", "#7F7F00", "#FFD700"]) {
    const c = finalise(bg);
    assert.ok(contrast(c.background, c.text) >= 4.5, bg);
    assert.ok(contrast(c.background, c.secondary) >= 3, bg);
  }
});
test("dominantColour picks the brand colour and ignores white and transparent", () => {
  const px = [];
  for (let i = 0; i < 400; i++) px.push(255, 255, 255, 255);
  for (let i = 0; i < 100; i++) px.push(0, 0, 0, 0);
  for (let i = 0; i < 200; i++) px.push(200, 30, 40, 255);
  const c = dominantColour(px);
  assert.ok(contrast(c.background, c.text) >= 4.5);
  const [r, g] = [1, 3].map((i) => parseInt(c.background.slice(i, i + 2), 16));
  assert.ok(r > g + 60, c.background);
});
test("dominantColour with nothing usable falls back to a valid colour", () => {
  assert.ok(isHex(dominantColour([255, 255, 255, 255, 0, 0, 0, 0]).background));
});
test("readableText", () => {
  assert.equal(readableText("#000000"), "#FFFFFF");
  assert.equal(readableText("#FFFFFF"), "#000000");
});
