import assert from "node:assert/strict";
import { test } from "node:test";
import {
  brandHash, buildLoyaltyClass, heroFromPhoto, heroSource, logoLuminance, paddedLogo, resize, walletColour,
  HERO_H, HERO_W, LOGO_SIZE,
} from "./wallet-branding.ts";

const solid = (w, h, [r, g, b, a = 255]) => {
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set([r, g, b, a], i * 4);
  return { width: w, height: h, data };
};
const px = (img, x, y) => Array.from(img.data.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 4));

test("colour: designed card colour beats brand colour, bad values fall back", () => {
  assert.equal(walletColour({ id: "1", name: "A", brand_color: "#112233", card_design: { color: "#445566" } }), "#445566");
  assert.equal(walletColour({ id: "1", name: "A", brand_color: "#112233", card_design: null }), "#112233");
  assert.match(walletColour({ id: "1", name: "A", brand_color: "red", card_design: { color: "nope" } }), /^#[0-9A-Fa-f]{6}$/);
});

test("hero source: card image first, then cover, https only", () => {
  assert.equal(heroSource({ id: "1", name: "A", cover_url: "https://x/c.jpg", card_design: { photo: "https://x/p.png" } }), "https://x/p.png");
  assert.equal(heroSource({ id: "1", name: "A", cover_url: "https://x/c.jpg" }), "https://x/c.jpg");
  assert.equal(heroSource({ id: "1", name: "A", cover_url: "http://x/c.jpg" }), null);
});

test("padded logo: square, contained, wide logo never cropped, circle-safe margin", () => {
  const wide = solid(400, 100, [0, 0, 0]);
  const out = paddedLogo(wide, "#336699");
  assert.equal(out.width, LOGO_SIZE);
  assert.equal(out.height, LOGO_SIZE);
  assert.deepEqual(px(out, 0, 0), [255, 255, 255, 255]); // dark logo gets a white tile
  assert.deepEqual(px(out, 330, 330), [0, 0, 0, 255]); // logo in the centre
  assert.deepEqual(px(out, 330, 100), [255, 255, 255, 255]); // empty above a wide logo
  assert.deepEqual(px(out, 10, 330), [255, 255, 255, 255]); // padded left edge
});

test("light logos get the shop colour tile so they stay visible", () => {
  const white = solid(100, 100, [250, 250, 250]);
  assert.ok(logoLuminance(white) > 0.8);
  assert.deepEqual(px(paddedLogo(white, "#336699"), 0, 0), [0x33, 0x66, 0x99, 255]);
});

test("transparent logo pixels show the tile, not black", () => {
  const out = paddedLogo(solid(50, 50, [0, 0, 0, 0]), "#336699");
  assert.deepEqual(px(out, 330, 330), [255, 255, 255, 255]);
});

test("hero from photo: exact size, centre crop without stretching", () => {
  const tall = solid(200, 400, [10, 20, 30]);
  const out = heroFromPhoto(tall);
  assert.equal(out.width, HERO_W);
  assert.equal(out.height, HERO_H);
  assert.deepEqual(px(out, 500, 100), [10, 20, 30, 255]);
});

test("resize keeps size and colour", () => {
  const out = resize(solid(10, 10, [1, 2, 3]), 7, 5);
  assert.equal(out.width, 7);
  assert.deepEqual(px(out, 3, 2), [1, 2, 3, 255]);
});

test("hash changes with its inputs", () => {
  assert.notEqual(brandHash("a", "#fff"), brandHash("a", "#000"));
  assert.equal(brandHash("a", "#fff"), brandHash("a", "#fff"));
});

test("class carries the shop's own branding, not Loyalty Loop's", () => {
  const cls = buildLoyaltyClass({
    shop: { id: "1", name: "Bean Bar", card_design: { color: "#445566" } },
    classId: "I.biz_1",
    programLogoUri: "https://s/logo.png",
    wideLogoUri: "https://s/wide.png",
    heroUri: "https://s/hero.png",
  });
  assert.equal(cls.issuerName, "Bean Bar");
  assert.equal(cls.programName, "Bean Bar");
  assert.equal(cls.hexBackgroundColor, "#445566");
  assert.equal(cls.programLogo.sourceUri.uri, "https://s/logo.png");
  assert.equal(cls.wideProgramLogo.sourceUri.uri, "https://s/wide.png");
  assert.equal(cls.heroImage.sourceUri.uri, "https://s/hero.png");
  assert.equal(cls.reviewStatus, undefined);
  const bare = buildLoyaltyClass({ shop: { id: "1", name: "B" }, classId: "x", programLogoUri: "u" });
  assert.equal("heroImage" in bare, false);
  assert.equal("wideProgramLogo" in bare, false);
});
