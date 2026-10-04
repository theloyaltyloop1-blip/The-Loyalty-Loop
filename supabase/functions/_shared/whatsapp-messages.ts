// WhatsApp message wording. Pure functions, so they run under Deno and in
// Node tests. Shops earn by £ spend or, while Fidel is still being built, by
// stamps / points / visits (reward_model 'stamp_legacy').

export type Tier = { title: string; spend_threshold_pence: number | null };
export type ShopProgress = {
  name: string;
  progressPence: number;
  thresholdPence: number | null;
  tiers: Tier[];
  // Set for stamp / points / visits shops, e.g. "3 of 10 stamps".
  stampLine?: string | null;
};

type StampSource = {
  reward_model?: string | null;
  loyalty_type?: string | null;
  loyalty_config?: { stamps_required?: number } | null;
};
type StampCounts = { stamp_count?: number | null; points_balance?: number | null; visit_count?: number | null };

// "3 of 10 stamps" for a stamp-model shop; null for a £ spend shop.
export function stampProgressText(business: StampSource, counts: StampCounts): string | null {
  if (business.reward_model === "spend_threshold") return null;
  const unit = business.loyalty_type === "points" ? "points" : business.loyalty_type === "tiered" ? "visits" : "stamps";
  const have = unit === "points" ? counts.points_balance ?? 0 : unit === "visits" ? counts.visit_count ?? 0 : counts.stamp_count ?? 0;
  return `${have} of ${business.loyalty_config?.stamps_required ?? 10} ${unit}`;
}

export function pounds(pence: number): string {
  const value = Math.abs(pence) / 100;
  const text = Number.isInteger(value) ? String(value) : value.toFixed(2);
  return (pence < 0 ? "-£" : "£") + text;
}

// Same rule as public.spend_next_tier: the lowest £ tier above the progress;
// if every tier is at or below it, the highest tier; with no £ tiers, the
// shop's single threshold as "Free reward".
export function nextTier(shop: ShopProgress): { title: string; amountPence: number } | null {
  const tiers = shop.tiers
    .filter((t): t is Tier & { spend_threshold_pence: number } => typeof t.spend_threshold_pence === "number")
    .sort((a, b) => a.spend_threshold_pence - b.spend_threshold_pence);
  if (tiers.length) {
    const above = tiers.find((t) => t.spend_threshold_pence > shop.progressPence);
    const tier = above ?? tiers[tiers.length - 1];
    return { title: tier.title, amountPence: tier.spend_threshold_pence };
  }
  return shop.thresholdPence ? { title: "Free reward", amountPence: shop.thresholdPence } : null;
}

export function progressLine(shop: ShopProgress): string {
  if (shop.stampLine) return `• ${shop.name}: ${shop.stampLine}`;
  const tier = nextTier(shop);
  if (!tier) return `• ${shop.name}: ${pounds(Math.max(shop.progressPence, 0))} spent`;
  const left = tier.amountPence - shop.progressPence;
  return left <= 0
    ? `• ${shop.name}: your ${tier.title} is ready`
    : `• ${shop.name}: ${pounds(Math.max(shop.progressPence, 0))} of ${pounds(tier.amountPence)} towards ${tier.title} (${pounds(left)} to go)`;
}

export function welcomeBack(firstName: string | null, shops: ShopProgress[], cardUrl: string): string {
  const hello = `Welcome back${firstName ? `, ${firstName}` : ""}!`;
  const list = shops.length
    ? `\n\nYour rewards:\n${shops.slice(0, 10).map(progressLine).join("\n")}${shops.length > 10 ? `\n…and ${shops.length - 10} more in the app.` : ""}`
    : "\n\nYou haven't joined any shops yet. Show your card at a Loyalty Loop shop to start earning.";
  return `${hello}${list}\n\nOpen your live card to show your QR code at the till: ${cardUrl}\n\nAsk me anything about your rewards. Send LOGOUT to unlink this number or STOP to stop messages.`;
}

export const STOP_REPLY =
  "Done — you won't get Loyalty Loop messages on WhatsApp any more. Your rewards are safe in the app. Send START any time to turn WhatsApp back on.";

export const LOGOUT_REPLY =
  "You're logged out on WhatsApp — this number is no longer linked to your Loyalty Loop account, and any card links sent here have stopped working. Your rewards are safe in the app. Send START to log in again — we'll ask for your email to check it's you.";

export const LOGGED_OUT_ALREADY = "This number isn't logged in to a Loyalty Loop account. Send START to log in.";

export function isLogout(text: string): boolean {
  return /^(log ?out|sign ?out|unlink)$/i.test(text.trim());
}

export function isStop(text: string): boolean {
  return /^(stop|unsubscribe|opt out|optout)$/i.test(text.trim());
}
