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

// Mirror of walletStanding in packages/loyalty/src/index.ts. Keep the two in
// step: packages/loyalty/test/wallet-fixtures.json is run against both.
type StandingLines = { label: string; value: string; goal: string; programName: string };
const walletPounds = (pence: number) =>
  `£${pence % 100 === 0 ? pence / 100 : (pence / 100).toFixed(2)}`;

function walletStandingLines(
  programme: "tiers" | "points",
  input: {
    tierName?: string | null;
    rollingSpendPence?: number | null;
    tiers?: WalletTier[];
    pointsBalance?: number | null;
    rewards?: { title: string; points_cost: number | null }[];
  },
): StandingLines {
  if (programme === "tiers") {
    const spend = Math.max(0, input.rollingSpendPence ?? 0);
    const ladder = (input.tiers ?? [])
      .filter((t) => (t.spend_threshold_pence ?? 0) > 0)
      .sort((a, b) => (a.spend_threshold_pence ?? 0) - (b.spend_threshold_pence ?? 0));
    const next = ladder.find((t) => (t.spend_threshold_pence ?? 0) > spend);
    const goal = next
      ? `Spend ${walletPounds((next.spend_threshold_pence ?? 0) - spend)} more for ${next.title} (spent in the last 12 months)`
      : ladder.length ? "You are at the top level" : "Levels are being set up";
    return { label: "Level", value: input.tierName ?? "No level yet", goal, programName: "Membership Card" };
  }
  const balance = Math.max(0, input.pointsBalance ?? 0);
  const costed = (input.rewards ?? [])
    .filter((r): r is { title: string; points_cost: number } => (r.points_cost ?? 0) > 0)
    .sort((a, b) => a.points_cost - b.points_cost);
  const next = costed.find((r) => r.points_cost > balance) ?? costed[0] ?? null;
  const goal = !next
    ? "Swap points for rewards in the app"
    : next.points_cost > balance
      ? `${next.points_cost - balance} more points for ${next.title}`
      : `Ready to swap for ${next.title}`;
  return { label: "Points", value: String(balance), goal, programName: "Points Card" };
}

function fromStanding(lines: StandingLines, shopName: string, what: string): WalletProgress {
  return {
    ...lines,
    about: what === "points"
      ? `Show this pass's QR code at ${shopName} to earn points, then swap them for rewards in the app.`
      : `Show this pass's QR code when you pay at ${shopName} and your spending in the last 12 months counts towards ${what}.`,
  };
}

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
  if (business.reward_model === "tiers") {
    return fromStanding(walletStandingLines("tiers", {
      tierName: membership.current_tier ?? null,
      rollingSpendPence: membership.rolling_spend_pence ?? 0,
      tiers,
    }), shopName, "a level");
  }
  if (business.reward_model === "points") {
    return fromStanding(walletStandingLines("points", {
      pointsBalance: membership.points_balance ?? 0,
      rewards: tiers.map((t) => ({ title: t.title, points_cost: t.points_cost ?? null })),
    }), shopName, "points");
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

/** Loads the shop's reward tiers (or, for points shops, its rewards) for walletProgress. */
export async function loadWalletTiers(admin: Admin, businessId: string, rewardModel?: string | null): Promise<WalletTier[]> {
  // points_cost only exists once the programme migration is applied, so it is
  // requested for points shops only; stamps and £ spend shops query as before.
  const columns = rewardModel === "points" ? "title,spend_threshold_pence,points_cost" : "title,spend_threshold_pence";
  const { data, error } = await admin
    .from("reward_catalog")
    .select(columns)
    .eq("business_id", businessId);
  if (error) throw error;
  return (data ?? []) as WalletTier[];
}

/**
 * Tier level spend (last 12 months) for tiers shops. Other shops return {}.
 * Reads the same figure as the app via member_rolling_spend.
 */
export async function loadWalletExtras(
  // deno-lint-ignore no-explicit-any
  admin: { rpc: (fn: string, args: Record<string, unknown>) => any },
  rewardModel: string | null | undefined,
  userId: string,
  businessId: string,
): Promise<Pick<WalletMembership, "rolling_spend_pence">> {
  if (rewardModel !== "tiers") return {};
  const { data, error } = await admin.rpc("member_rolling_spend", { _user_id: userId, _business_id: businessId });
  if (error) throw error;
  return { rolling_spend_pence: Number(data ?? 0) };
}
