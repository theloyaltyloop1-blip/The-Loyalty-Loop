// Delivers Expo push notifications for one announcement.
//
// Called by the database (pg_net) right after a shop announcement or a
// Loyalty Loop team announcement is published — see migration
// 20260912150000_announcement_push.sql. The trigger has already written one
// public.notifications row per recipient (shop members who have not opted out
// of that shop's promotions, or every profile for team announcements) with
// announcement_id set. This function:
//   1. claims those rows atomically (push_sent_at is null → now), so re-running
//      it — or two overlapping calls — can never double-send;
//   2. drops recipients who turned off "offers" globally (shop announcements
//      only; team announcements always go);
//   3. sends to every registered device in batches of 100, prunes tokens Expo
//      reports as DeviceNotRegistered, and records per-row delivery errors.
// It needs no caller secret: the only thing it can do is deliver pushes that
// the database has already decided should be delivered.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const jsonHeaders = { "Content-Type": "application/json" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const CLAIM_BATCH = 400;
const EXPO_BATCH = 100;

type Pending = { id: string; user_id: string; business_id: string | null; kind: string; title: string; body: string | null };
type Ticket = { status?: string; message?: string; details?: { error?: string } };

const json = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), { status, headers: jsonHeaders });

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const body = await req.json().catch(() => ({}));
  const announcementId = typeof body?.announcement_id === "string" ? body.announcement_id : "";
  if (!UUID.test(announcementId)) return json({ error: "announcement_id (uuid) is required" }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const summary = { claimed: 0, pushed: 0, skippedOptedOut: 0, skippedNoDevice: 0, deliveryErrors: 0, prunedTokens: 0 };
  const errorsByNotification = new Map<string, string>();
  let businessNameCache: string | null | undefined;

  try {
    for (;;) {
      const { data: candidates, error: candidateError } = await admin
        .from("notifications")
        .select("id")
        .eq("announcement_id", announcementId)
        .is("push_sent_at", null)
        .limit(CLAIM_BATCH);
      if (candidateError) throw candidateError;
      if (!candidates?.length) break;

      const { data: rows, error: claimError } = await admin
        .from("notifications")
        .update({ push_sent_at: new Date().toISOString() })
        .in("id", candidates.map((c) => c.id))
        .is("push_sent_at", null)
        .select("id,user_id,business_id,kind,title,body");
      if (claimError) throw claimError;
      const pending = (rows ?? []) as Pending[];
      if (!pending.length) continue;
      summary.claimed += pending.length;

      const userIds = [...new Set(pending.map((row) => row.user_id))];
      const isPromo = pending[0].kind === "promo";
      const businessId = pending[0].business_id;

      const optedOut = new Set<string>();
      if (isPromo) {
        const { data: settings } = await admin.from("user_settings").select("user_id").in("user_id", userIds).eq("notify_offers", false);
        settings?.forEach((s) => optedOut.add(s.user_id));
      }
      const { data: tokenRows } = await admin.from("push_tokens").select("token,user_id").in("user_id", userIds);
      const tokensByUser = new Map<string, string[]>();
      tokenRows?.forEach(({ token, user_id }) => tokensByUser.set(user_id, [...(tokensByUser.get(user_id) ?? []), token]));

      if (businessNameCache === undefined) {
        businessNameCache = businessId
          ? (await admin.from("businesses").select("name").eq("id", businessId).maybeSingle()).data?.name ?? null
          : null;
      }
      const pushTitle = businessNameCache ?? "The Loyalty Loop";

      const messages: { to: string; sound: "default"; title: string; body: string; data: Record<string, string | null> }[] = [];
      const messageOwners: string[] = [];
      for (const row of pending) {
        if (optedOut.has(row.user_id)) {
          errorsByNotification.set(row.id, "recipient opted out of offers");
          summary.skippedOptedOut++;
          continue;
        }
        const tokens = tokensByUser.get(row.user_id) ?? [];
        if (!tokens.length) {
          errorsByNotification.set(row.id, "no registered device");
          summary.skippedNoDevice++;
          continue;
        }
        const text = row.body?.trim() ? `${row.title}\n${row.body.trim()}` : row.title;
        for (const token of tokens) {
          messages.push({ to: token, sound: "default", title: pushTitle, body: text, data: { notificationId: row.id, businessId: row.business_id, announcementId } });
          messageOwners.push(row.id);
        }
      }

      const deadTokens = new Set<string>();
      let offset = 0;
      for (const batch of chunk(messages, EXPO_BATCH)) {
        const response = await fetch(EXPO_PUSH_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(batch),
        });
        if (!response.ok) {
          batch.forEach((_, i) => errorsByNotification.set(messageOwners[offset + i], "Expo Push Service rejected the request"));
          summary.deliveryErrors += batch.length;
        } else {
          const payload = (await response.json()) as { data?: Ticket[] };
          (payload.data ?? []).forEach((ticket, i) => {
            if (ticket.status === "ok") {
              summary.pushed++;
              return;
            }
            summary.deliveryErrors++;
            const reason = ticket.details?.error ?? ticket.message ?? "unknown error";
            errorsByNotification.set(messageOwners[offset + i], reason);
            if (ticket.details?.error === "DeviceNotRegistered") deadTokens.add(batch[i].to);
          });
        }
        offset += batch.length;
      }
      if (deadTokens.size) {
        await admin.from("push_tokens").delete().in("token", [...deadTokens]);
        summary.prunedTokens += deadTokens.size;
      }
    }

    // Record outcomes, grouped by message so this is a handful of updates, not thousands.
    const idsByError = new Map<string, string[]>();
    errorsByNotification.forEach((reason, id) => idsByError.set(reason, [...(idsByError.get(reason) ?? []), id]));
    for (const [reason, ids] of idsByError) {
      for (const batch of chunk(ids, 500)) await admin.from("notifications").update({ push_error: reason }).in("id", batch);
    }
    return json({ ok: true, ...summary });
  } catch (error) {
    console.error("send-announcement-push failed", error);
    return json({ error: error instanceof Error ? error.message : "internal error", ...summary }, 500);
  }
});
