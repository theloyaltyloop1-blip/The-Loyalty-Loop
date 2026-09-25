// Push dispatch for notification rows (ARCH_PLAN.md §4.11). Pure logic with an
// injected store and fetch, so it runs under Deno and in Node tests.

export type PendingNotification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  businessId: string | null;
};

export type PushSettings = {
  notify_stamps?: boolean | null;
  notify_rewards?: boolean | null;
  notify_offers?: boolean | null;
} | null;

export type PushStore = {
  pending: (userId: string, businessId: string, sinceIso: string) => Promise<PendingNotification[]>;
  settings: (userId: string) => Promise<PushSettings>;
  tokens: (userId: string) => Promise<string[]>;
  // handled=true stops retries (sent, opted out, no device); false records the
  // error but leaves the row unsent so a later dispatch can retry it.
  mark: (ids: string[], error: string | null, handled?: boolean) => Promise<void>;
};

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const WINDOW_MS = 30 * 60 * 1000;
const EXPO_BATCH = 100;

function allowed(kind: string, settings: PushSettings): boolean {
  if (kind === "stamp") return settings?.notify_stamps !== false;
  if (kind === "reward") return settings?.notify_rewards !== false;
  if (kind === "promo") return settings?.notify_offers !== false;
  return true;
}

// Sends every unsent notification for this customer at this shop from the last
// 30 minutes (for example a reward and a progress update from one purchase).
// Opted-out rows are marked handled so they are never retried.
export async function sendPendingPushes(
  store: PushStore,
  fetchFn: Fetch,
  userId: string,
  businessId: string,
  nowMs = Date.now(),
): Promise<{ sent: number; optedOut: number; reason?: string; deliveryErrors?: number }> {
  const pending = await store.pending(userId, businessId, new Date(nowMs - WINDOW_MS).toISOString());
  if (!pending.length) return { sent: 0, optedOut: 0, reason: "no pending notification" };

  const settings = await store.settings(userId);
  const sendable = pending.filter((n) => allowed(n.kind, settings));
  const optedOut = pending.filter((n) => !allowed(n.kind, settings));
  if (optedOut.length) await store.mark(optedOut.map((n) => n.id), "recipient opted out");
  if (!sendable.length) return { sent: 0, optedOut: optedOut.length, reason: "recipient opted out" };

  const tokens = await store.tokens(userId);
  if (!tokens.length) {
    await store.mark(sendable.map((n) => n.id), "no registered device");
    return { sent: 0, optedOut: optedOut.length, reason: "no registered device" };
  }

  const messages = sendable.flatMap((n) => tokens.map((to) => ({
    to,
    sound: "default",
    title: n.title,
    body: n.body ?? "",
    data: { notificationId: n.id, businessId: n.businessId ?? businessId },
  })));

  const errors: string[] = [];
  for (let start = 0; start < messages.length; start += EXPO_BATCH) {
    const response = await fetchFn(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages.slice(start, start + EXPO_BATCH)),
    });
    if (!response.ok) {
      await store.mark(sendable.map((n) => n.id), "Expo Push Service rejected the request", false);
      throw new Error("push provider rejected the request");
    }
    const payload = await response.json() as { data?: Array<{ status?: string; details?: { error?: string } }> };
    for (const item of payload.data ?? []) {
      if (item.status !== "ok" && item.details?.error) errors.push(item.details.error);
    }
  }
  await store.mark(sendable.map((n) => n.id), errors.length ? [...new Set(errors)].join(", ") : null);
  return { sent: sendable.length, optedOut: optedOut.length, deliveryErrors: errors.length };
}
