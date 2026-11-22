import { defaultDesignFor, normalizeDesign } from "../../../packages/card-design/model";
import { supabase } from "./supabase";

// After a shop sets its logo, ask the suggest-card-colour function for the card colour
// that suits it and save it as brand_color + card_design. Only runs for shops that have
// not designed their card (card_design is null), so an owner's own design is never
// overwritten. Never throws: if anything fails the card keeps its current colour.
export async function autoCardColour(business: {
  id: string;
  category?: string | null;
  card_design?: unknown;
}): Promise<boolean> {
  try {
    if (business.card_design) return false;
    const { data, error } = await supabase.functions.invoke("suggest-card-colour", { body: { business_id: business.id } });
    if (error || !data || !/^#[0-9A-Fa-f]{6}$/.test(data.background)) return false;
    if (data.source === "default") return false; // nothing learned from the logo
    const base = defaultDesignFor(business.category, data.background);
    const design = normalizeDesign({ ...base, color: data.background, secondary: data.secondary }, data.background);
    const { error: saveError } = await supabase
      .from("businesses")
      .update({ brand_color: data.background, card_design: design })
      .eq("id", business.id)
      .is("card_design", null);
    return !saveError;
  } catch {
    return false;
  }
}
