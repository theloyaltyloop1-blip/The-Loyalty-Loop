// Card linking core (CARD_LINKING_PLAN.md §3). Pure functions with injected
// Fidel HTTP and database access, so they run under Deno and in Node tests.
// Never log or return the Fidel API key, the SDK key or Fidel card ids to a
// client; only display fields leave these functions.

export const CARD_LIMIT = 5;
const FIDEL_API_BASE = "https://api.fidel.uk/v1";
const MAX_LIST_PAGES = 10;

export type Env = (name: string) => string | undefined;
export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export type Rpc = (fn: string, args: Record<string, unknown>) => Promise<{
  data: unknown;
  error: { code?: string; message?: string } | null;
}>;

export type CardDb = {
  rpc: Rpc;
  activeCards: (userId: string) => Promise<DisplayCard[]>;
  isAdmin: (userId: string) => Promise<boolean>;
};

export type DisplayCard = {
  linkedCardId: string;
  scheme: string | null;
  lastNumbers: string | null;
  linkedAt: string;
};

export type FidelCard = {
  id: string;
  accountId: string | null;
  programId: string;
  scheme: string | null;
  lastNumbers: string | null;
  live: boolean;
  metadataId: string | null;
};

export type FidelConfig = {
  apiKey: string;
  sdkKey: string;
  programId: string;
  live: boolean;
  enabled: boolean;
};

export class CardLinkError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

// Reads configuration. The key prefix decides test vs live, so a test card can
// never be accepted by a live deployment or the reverse.
export function fidelConfig(env: Env): FidelConfig | null {
  const apiKey = env("FIDEL_API_KEY") ?? "";
  const sdkKey = env("FIDEL_SDK_KEY") ?? "";
  const programId = env("FIDEL_PROGRAM_ID") ?? "";
  const apiLive = apiKey.startsWith("sk_live_");
  const apiTest = apiKey.startsWith("sk_test_");
  const sdkLive = sdkKey.startsWith("pk_live_");
  const sdkTest = sdkKey.startsWith("pk_test_");
  if (!programId || !(apiLive || apiTest) || !(sdkLive || sdkTest) || apiLive !== sdkLive) {
    return null;
  }
  return {
    apiKey,
    sdkKey,
    programId,
    live: apiLive,
    enabled: env("FIDEL_CARD_LINKING_ENABLED") === "true",
  };
}

function nonemptyString(value: unknown, max = 200): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}

function normalizeScheme(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const scheme = value.toLowerCase();
  if (scheme === "americanexpress" || scheme === "american express") return "amex";
  return ["visa", "mastercard", "amex"].includes(scheme) ? scheme : null;
}

function parseFidelCard(item: unknown): FidelCard | null {
  if (item === null || typeof item !== "object") return null;
  const card = item as Record<string, unknown>;
  if (!nonemptyString(card.id) || !nonemptyString(card.programId) || typeof card.live !== "boolean") {
    return null;
  }
  const metadata = card.metadata && typeof card.metadata === "object"
    ? card.metadata as Record<string, unknown>
    : null;
  const lastNumbers = typeof card.lastNumbers === "string" && /^[0-9]{4}$/.test(card.lastNumbers)
    ? card.lastNumbers
    : null;
  return {
    id: card.id,
    accountId: nonemptyString(card.accountId) ? card.accountId : null,
    programId: card.programId,
    scheme: normalizeScheme(card.scheme),
    lastNumbers,
    live: card.live,
    metadataId: metadata && nonemptyString(metadata.id) ? metadata.id : null,
  };
}

export async function listCardsByMetadata(
  fetchFn: Fetch,
  config: FidelConfig,
  metadataId: string,
): Promise<FidelCard[]> {
  const cards: FidelCard[] = [];
  let start: unknown = undefined;
  for (let page = 0; page < MAX_LIST_PAGES; page += 1) {
    const query = new URLSearchParams({ limit: "100" });
    if (start !== undefined) query.set("start", JSON.stringify(start));
    const response = await fetchFn(
      `${FIDEL_API_BASE}/cards/metadata/${encodeURIComponent(metadataId)}?${query}`,
      { headers: { "Content-Type": "application/json", "Fidel-Key": config.apiKey } },
    );
    if (!response.ok) throw new CardLinkError(502, `fidel_list_failed_${response.status}`);
    const body = await response.json() as Record<string, unknown>;
    const items = Array.isArray(body.items) ? body.items : [];
    for (const item of items) {
      const card = parseFidelCard(item);
      if (card) cards.push(card);
    }
    if (!body.last || items.length === 0) return cards;
    start = body.last;
  }
  return cards;
}

// Returns true when Fidel no longer holds the card (deleted now or already gone).
export async function deleteFidelCard(
  fetchFn: Fetch,
  config: FidelConfig,
  fidelCardId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetchFn(`${FIDEL_API_BASE}/cards/${encodeURIComponent(fidelCardId)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "Fidel-Key": config.apiKey },
    });
    if (response.ok || response.status === 404) return { ok: true };
    return { ok: false, error: `fidel_delete_${response.status}` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? `fidel_delete_network: ${error.message}` : "fidel_delete_network" };
  }
}

async function rpcOrThrow<T>(db: CardDb, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(fn, args);
  if (error) {
    console.error("fidel-cards rpc failed", fn, error.code ?? "unknown");
    throw new CardLinkError(500, "server_error");
  }
  return data as T;
}

// --- fidel-card-session ---------------------------------------------------

export const CONSENT = {
  companyName: "The Loyalty Loop",
  programName: "The Loyalty Loop",
  termsAndConditionsUrl: "https://www.the-loyalty-loop.com/legal/terms-of-service.pdf",
  privacyPolicyUrl: "https://www.the-loyalty-loop.com/legal/privacy-notice.pdf",
  deleteInstructions: "removing it in Your account › Linked cards",
};

// Named test accounts (FIDEL_CARD_LINKING_TESTER_IDS, comma-separated user ids)
// can link cards while the kill switch is off, without being made admins.
function isNamedTester(env: Env, userId: string): boolean {
  return (env("FIDEL_CARD_LINKING_TESTER_IDS") ?? "")
    .split(",")
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean)
    .includes(userId.toLowerCase());
}

export async function cardSession(deps: { env: Env; db: CardDb }, userId: string) {
  const config = fidelConfig(deps.env);
  // Admins and named testers can test while the kill switch is off; everyone
  // else sees nothing.
  const enabled = config !== null &&
    (config.enabled || isNamedTester(deps.env, userId) || await deps.db.isAdmin(userId));
  if (!enabled || !config) return { enabled: false };

  const cards = await deps.db.activeCards(userId);
  if (cards.length >= CARD_LIMIT) {
    return { enabled: true, atLimit: true, activeCount: cards.length, limit: CARD_LIMIT, cards };
  }
  const metadataId = await rpcOrThrow<string>(deps.db, "fidel_link_identity", { _user_id: userId });
  return {
    enabled: true,
    atLimit: false,
    activeCount: cards.length,
    limit: CARD_LIMIT,
    cards,
    sdkKey: config.sdkKey,
    programId: config.programId,
    metadataId,
    consent: CONSENT,
  };
}

// --- fidel-card-claim -----------------------------------------------------

type ClaimResult = { status: string; linked_card_id?: string };

export async function claimCards(
  deps: { env: Env; db: CardDb; fetch: Fetch },
  userId: string,
  body: unknown,
) {
  const config = fidelConfig(deps.env);
  if (!config) throw new CardLinkError(503, "not_configured");
  const requested = body && typeof body === "object" ? (body as Record<string, unknown>).cardId : undefined;
  if (requested !== undefined && requested !== null && !nonemptyString(requested)) {
    throw new CardLinkError(400, "invalid_card_id");
  }
  // Claiming never needs the kill switch: a card enrolled before a switch-off
  // must still be recoverable. Only the session hands out the SDK key.
  const metadataId = await rpcOrThrow<string>(deps.db, "fidel_link_identity", { _user_id: userId });

  // Never trust the client's card id: accept only cards Fidel lists under this
  // user's secret metadata id, in our program and our environment.
  const listed = (await listCardsByMetadata(deps.fetch, config, metadataId)).filter(card =>
    card.metadataId === metadataId && card.programId === config.programId && card.live === config.live
  );
  const candidates = typeof requested === "string"
    ? listed.filter(card => card.id === requested)
    : listed;

  const outcomes: string[] = [];
  for (const card of candidates) {
    const result = await rpcOrThrow<ClaimResult>(deps.db, "claim_linked_card", {
      _user_id: userId,
      _fidel_card_id: card.id,
      _fidel_account_id: card.accountId,
      _card_scheme: card.scheme,
      _last_numbers: card.lastNumbers,
    });
    if (result.status === "limit_reached") {
      // Don't leave an ownerless card enrolled in our program.
      const deleted = await deleteFidelCard(deps.fetch, config, card.id);
      if (!deleted.ok) console.error("fidel-card-claim cap delete failed", deleted.error);
    }
    outcomes.push(result.status);
  }

  const cards = await deps.db.activeCards(userId);
  const status = outcomes.includes("claimed") ? "claimed"
    : outcomes.includes("limit_reached") ? "limit_reached"
    : outcomes.includes("already_linked_elsewhere") ? "already_linked_elsewhere"
    : outcomes.includes("already_linked") ? "already_linked"
    : typeof requested === "string" ? "not_found"
    : "nothing_to_claim";
  return { status, cards };
}

// --- fidel-card-unlink ----------------------------------------------------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function unlinkCard(
  deps: { env: Env; db: CardDb; fetch: Fetch },
  userId: string,
  body: unknown,
) {
  const linkedCardId = body && typeof body === "object"
    ? (body as Record<string, unknown>).linkedCardId
    : undefined;
  if (typeof linkedCardId !== "string" || !UUID.test(linkedCardId)) {
    throw new CardLinkError(400, "invalid_linked_card_id");
  }
  // Step 1 stops earning in the same commit, whatever Fidel does next.
  const result = await rpcOrThrow<{ status: string; fidel_card_id?: string }>(
    deps.db, "unlink_linked_card", { _user_id: userId, _linked_card_id: linkedCardId, _reason: "user" },
  );
  if (result.status !== "unlinked" || !result.fidel_card_id) {
    throw new CardLinkError(404, "not_found");
  }
  // Step 2: delete at Fidel. A failure is recorded for the retry sweep; the
  // shopper still sees "Removed" because earning has already stopped.
  const config = fidelConfig(deps.env);
  const deleted = config
    ? await deleteFidelCard(deps.fetch, config, result.fidel_card_id)
    : { ok: false as const, error: "not_configured" };
  await rpcOrThrow(deps.db, "mark_fidel_card_deleted", {
    _linked_card_id: linkedCardId,
    _error: deleted.ok ? null : deleted.error,
  });
  if (!deleted.ok) console.warn("fidel-card-unlink Fidel delete deferred", deleted.error);
  return { status: "removed", cards: await deps.db.activeCards(userId) };
}

// --- retry sweep and account deletion --------------------------------------

export async function sweepPendingDeletes(deps: { env: Env; db: CardDb; fetch: Fetch }, nowMs = Date.now()) {
  const config = fidelConfig(deps.env);
  if (!config) throw new CardLinkError(503, "not_configured");
  const rows = await rpcOrThrow<Array<{ linked_card_id: string; fidel_card_id: string; unlinked_at: string }>>(
    deps.db, "fidel_cards_pending_delete", { _max_rows: 50 },
  );
  let deleted = 0, failed = 0, overdue = 0;
  for (const row of rows ?? []) {
    const result = await deleteFidelCard(deps.fetch, config, row.fidel_card_id);
    await rpcOrThrow(deps.db, "mark_fidel_card_deleted", {
      _linked_card_id: row.linked_card_id,
      _error: result.ok ? null : result.error,
    });
    if (result.ok) deleted += 1;
    else {
      failed += 1;
      if (nowMs - Date.parse(row.unlinked_at) > 24 * 60 * 60 * 1000) overdue += 1;
    }
  }
  if (overdue > 0) console.error("fidel-card-delete-sweep ALERT: cards undeleted at Fidel for over 24h", overdue);
  return { checked: rows?.length ?? 0, deleted, failed, overdue };
}

// For delete-my-account (plan §3.4, P4). Deletes every card still held at
// Fidel. Returns false if any delete failed; the caller must then stop and keep
// the account, rather than orphan cards it can no longer trace.
export async function deleteAllFidelCardsForUser(
  deps: { env: Env; fetch: Fetch },
  cards: Array<{ fidel_card_id: string; fidel_deleted_at: string | null }>,
): Promise<boolean> {
  const pending = cards.filter(card => card.fidel_deleted_at === null);
  if (pending.length === 0) return true;
  const config = fidelConfig(deps.env);
  if (!config) return false;
  let allDeleted = true;
  for (const card of pending) {
    const result = await deleteFidelCard(deps.fetch, config, card.fidel_card_id);
    if (!result.ok) {
      console.error("delete-my-account Fidel card delete failed", result.error);
      allDeleted = false;
    }
  }
  return allDeleted;
}
