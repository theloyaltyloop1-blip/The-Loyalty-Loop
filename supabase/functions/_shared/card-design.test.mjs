import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { contrast } from "./card-colour.ts";
import { BACKGROUNDS, ICONS, TYPEFACES, LAYOUTS, ENTRANCES, POSITIONS, finaliseDesign, parseAiDesign, fallbackDesign } from "./card-design.ts";

const ctx = { category: "Cafe", hasLogo: true, coverUrl: "https://x/storage/v1/object/public/covers/a.jpg", stamps: true };

test("option lists match packages/card-design/model.ts", () => {
  const src = readFileSync(new URL("../../../packages/card-design/model.ts", import.meta.url), "utf8");
  const grab = (n) => [...src.match(new RegExp(`export const ${n} = \\[([^\\]]+)\\]`))[1].matchAll(/"(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(grab("BACKGROUNDS"), [...BACKGROUNDS]);
  assert.deepEqual(grab("ICONS"), [...ICONS]);
  assert.deepEqual(grab("TYPEFACES"), [...TYPEFACES]);
  assert.deepEqual(grab("LAYOUTS"), [...LAYOUTS]);
  assert.deepEqual(grab("ENTRANCES"), [...ENTRANCES]);
  assert.deepEqual(grab("POSITIONS"), [...POSITIONS]);
});
test("unknown values are replaced and colours get readable", () => {
  const d = parseAiDesign('{"background":"neon","color":"#808080","secondary":"#818181","icon":"rocket","font":"comic","layout":"spiral","evil":"x"}', ctx);
  assert.ok(d);
  assert.ok(BACKGROUNDS.includes(d.background) && ICONS.includes(d.icon) && TYPEFACES.includes(d.font) && LAYOUTS.includes(d.layout));
  assert.equal(d.version, 1);
  assert.equal("evil" in d, false);
  assert.ok(contrast(d.color, d.secondary) >= 3);
  assert.ok(Math.max(contrast(d.color, "#FFFFFF"), contrast(d.color, "#000000")) >= 4.5);
});
test("photo only from our cover, logo icon needs a logo, non-stamp avoids grid/row", () => {
  assert.equal(finaliseDesign({ background: "photo" }, ctx).photo, ctx.coverUrl);
  assert.notEqual(finaliseDesign({ background: "photo" }, { ...ctx, coverUrl: null }).background, "photo");
  assert.notEqual(finaliseDesign({ icon: "logo" }, { ...ctx, hasLogo: false }).icon, "logo");
  assert.equal(finaliseDesign({ layout: "grid" }, { ...ctx, stamps: false }).layout, "ring");
  assert.equal(finaliseDesign({ photo: "https://evil/x.jpg", background: "solid" }, ctx).photo, null);
});
test("garbage and non-JSON are rejected; fallback is valid", () => {
  assert.equal(parseAiDesign("sorry", ctx), null);
  assert.equal(parseAiDesign('{"hello":1}', ctx), null);
  for (const cat of ["Cafe", "Barber", "Bakery", "Gym", "Dog groomer", "Bookshop", null]) {
    const d = fallbackDesign({ ...ctx, category: cat }, { background: "#C0392B", secondary: "#F5E6C8" });
    assert.ok(Math.max(contrast(d.color, "#FFFFFF"), contrast(d.color, "#000000")) >= 4.5);
    assert.equal(d.photo, null);
  }
  assert.equal(fallbackDesign({ ...ctx, category: "Bookshop" }, { background: "#C0392B", secondary: "#F5E6C8" }).color, "#C0392B");
});
