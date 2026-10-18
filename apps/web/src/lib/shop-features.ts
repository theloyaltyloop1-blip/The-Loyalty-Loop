// Shop features shoppers can filter by. Keep in step with the
// businesses_features_allowed_check constraint (migration 20261018002046).
export const SHOP_FEATURES = [
  { id: "halal", label: "Halal" },
  { id: "vegetarian", label: "Vegetarian options" },
  { id: "vegan", label: "Vegan options" },
  { id: "gluten_free", label: "Gluten-free options" },
  { id: "kids_friendly", label: "Kids friendly" },
  { id: "wheelchair_accessible", label: "Wheelchair accessible" },
] as const;

export type ShopFeatureId = (typeof SHOP_FEATURES)[number]["id"];

export const HALAL_CERTIFIERS = ["HMC", "HFA"] as const;

/** Badge text for one feature; halal is shown as the shop's own claim unless certified. */
export function featureBadge(id: string, halalCertifier?: string | null): string {
  if (id === "halal") return halalCertifier ? `Halal (certified by ${halalCertifier})` : "Halal (as stated by the shop)";
  return SHOP_FEATURES.find((f) => f.id === id)?.label ?? id;
}

/** True when the shop has every selected feature. */
export function hasAllFeatures(shopFeatures: readonly string[] | null | undefined, selected: readonly string[]): boolean {
  return selected.every((id) => (shopFeatures ?? []).includes(id));
}
