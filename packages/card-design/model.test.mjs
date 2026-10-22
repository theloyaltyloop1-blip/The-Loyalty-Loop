import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BACKGROUNDS,
  ICONS,
  LAYOUTS,
  TEMPLATES,
  normalizeDesign,
  foreground,
  cardProgress,
  checkPhoto,
} from "./model.ts";
test("legacy and malformed designs fall back without throwing", () => {
  for (const input of [
    null,
    undefined,
    [],
    "bad",
    { version: 9, layout: "canvas", color: "red", photo: "javascript:bad" },
  ]) {
    const d = normalizeDesign(input, "#123456");
    assert.equal(d.version, 1);
    assert.equal(d.color, "#123456");
    assert.ok(LAYOUTS.includes(d.layout));
    assert.equal(d.photo, null);
  }
});
test("all templates round-trip, and every material/icon/layout is accepted", () => {
  for (const t of TEMPLATES)
    assert.deepEqual(normalizeDesign(t.design), t.design);
  for (const background of BACKGROUNDS)
    for (const icon of ICONS)
      for (const layout of LAYOUTS) {
        const d = normalizeDesign({
          ...TEMPLATES[0].design,
          background,
          icon,
          layout,
        });
        assert.equal(d.background, background);
        assert.equal(d.icon, icon);
        assert.equal(d.layout, layout);
      }
});
test("automatic text contrast meets WCAG AA across the colour space", () => {
  for (let n = 0; n <= 0xffffff; n += 7919) {
    const color = "#" + n.toString(16).padStart(6, "0");
    const rgb = color
      .slice(1)
      .match(/../g)
      .map((v) => {
        const n = parseInt(v, 16) / 255;
        return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
      });
    const l = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    const ratio =
      foreground(color) === "#000000" ? (l + 0.05) / 0.05 : 1.05 / (l + 0.05);
    assert.ok(ratio >= 4.5, `${color}: ${ratio}`);
  }
});
test("progress is bounded for refunds, invalid data and large goals", () => {
  assert.equal(cardProgress(-5, 10).fraction, 0);
  assert.equal(cardProgress(20, 10).fraction, 1);
  assert.equal(cardProgress(3, 10).fraction, 0.3);
  assert.equal(cardProgress(999, 10000).slots, 20);
  assert.equal(cardProgress(NaN, 0).fraction, 0);
});
test("upload checks reject tiny, oversized, animated and unsupported files", () => {
  checkPhoto(1200, 800, 100000, "image/jpeg");
  for (const args of [
    [100, 100, 1000, "image/png"],
    [1000, 800, 6000000, "image/jpeg"],
    [1000, 800, 1000, "image/gif"],
    [NaN, 800, 1000, "image/png"],
    [13000, 800, 1000, "image/webp"],
  ])
    assert.throws(() => checkPhoto(...args));
});

test("reference palette ink and accent stay readable", async () => {
  const { cardInk, cardAccent, contrast } = await import("./model.ts");
  for (const { design } of TEMPLATES) {
    assert.ok(contrast(design.color, cardInk(design.color)) >= 4.5);
    assert.ok(contrast(design.color, cardAccent(design)) >= 3);
  }
});

test("continuous programmes adapt stamp templates to one supported layout", async () => {
  const { designForProgress } = await import("./model.ts");
  for (const { design } of TEMPLATES) {
    const adapted = designForProgress(design, false);
    assert.ok(["ring", "jar", "bar"].includes(adapted.layout));
    assert.equal(designForProgress(design, true), design);
  }
});

test('decorative materials preserve contrast even near the text-colour crossover', async()=>{
 const {cardInk,contrast,materialOpacity}=await import('./model.ts');
 for(let n=0;n<256;n+=3){const color='#'+n.toString(16).padStart(2,'0').repeat(3);const alpha=.65*materialOpacity(color);for(const end of [0,255]){const v=Math.round(n*(1-alpha)+end*alpha).toString(16).padStart(2,'0');assert.ok(contrast('#'+v.repeat(3),cardInk(color))>=4.5);}}
});
