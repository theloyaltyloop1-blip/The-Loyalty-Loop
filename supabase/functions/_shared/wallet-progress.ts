// What a Google or Apple Wallet pass shows for a customer's progress at a shop.
// Spend shops (ARCH_PLAN.md §4.11) show £ towards the next reward tier: the
// lowest tier above the customer's progress, or the top tier, where a new round
// starts. This mirrors spend_next_tier in the database. Stamp shops keep the
// old count until the switchover moves them.

export type WalletBusiness = {
  loyalty_type?: string | null;
  loyalty_config?: unknown;
  reward_model?: string | null;
  reward_threshold_pence?: number | null;
};
export type WalletMembership = {
  stamp_count?: number | null;
  points_balance?: number | null;
  reward_progress_pence?: number | null;
};
export type WalletTier = { title: string; spend_threshold_pence: number | null };

export type WalletProgress = {
  label: string;
  value: string;
  goal: string;
  about: string;
  programName: string;
};

const pounds = (pence: number) => `£${pence % 100 === 0 ? pence / 100 : (pence / 100).toFixed(2)}`;

export function walletProgress(
  business: WalletBusiness,
  membership: WalletMembership,
  tiers: WalletTier[],
  shopName: string,
): WalletProgress {
  if (business.reward_model === "spend_threshold") {
    const progress = Math.max(0, membership.reward_progress_pence ?? 0);
    const sorted = tiers
      .filter((t): t is { title: string; spend_threshold_pence: number } => (t.spend_threshold_pence ?? 0) > 0)
      .sort((a, b) => a.spend_threshold_pence - b.spend_threshold_pence);
    const next = sorted.find((t) => t.spend_threshold_pence > progress) ?? sorted[sorted.length - 1];
    const target = next?.spend_threshold_pence ?? business.reward_threshold_pence ?? 2000;
    const remaining = Math.max(0, target - progress);
    return {
      label: "Spent",
      value: pounds(progress),
      goal: remaining === 0
        ? `${next?.title ?? "Your reward"} is on its way`
        : `Spend ${pounds(remaining)} more for ${next?.title ?? "your next reward"}`,
      about: `Show this pass's QR code when you pay at ${shopName} and what you spend counts towards rewards.`,
      programName: "Rewards Card",
    };
  }
  const label = business.loyalty_type === "points" ? "Points" : business.loyalty_type === "tiered" ? "Visits" : "Stamps";
  const required = (business.loyalty_config as { stamps_required?: number } | null)?.stamps_required ?? 10;
  const value = business.loyalty_type === "points" ? membership.points_balance ?? 0 : membership.stamp_count ?? 0;
  return {
    label,
    value: String(value),
    goal: `${required} ${label.toLowerCase()} to unlock your reward`,
    about: `Show this pass's QR code at ${shopName} to collect ${label.toLowerCase()}.`,
    programName: `${label === "Points" ? "Points" : label === "Visits" ? "Visits" : "Stamp"} Card`,
  };
}

// deno-lint-ignore no-explicit-any
type Admin = { from: (table: string) => any };

/** Loads the shop's reward tiers for walletProgress. */
export async function loadWalletTiers(admin: Admin, businessId: string): Promise<WalletTier[]> {
  const { data, error } = await admin
    .from("reward_catalog")
    .select("title,spend_threshold_pence")
    .eq("business_id", businessId);
  if (error) throw error;
  return (data ?? []) as WalletTier[];
}
