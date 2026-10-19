// One sync pass for one connected shop: fetch new/changed till sales, record
// them, apply refunds, then settle each open sale with the matcher. Written
// against small interfaces so it can be tested without SumUp or a database.

import { matchSales, type PosScan, type PosSale } from "./pos-matcher.ts";
import { refreshTokens, listSales, SumUpError, type Fetch, type SumUpSale } from "./sumup.ts";

export interface PosConnection {
  id: string;
  businessId: string;
  merchantCode: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: number;
  syncCursor: number | null;
}

export interface StoredSale {
  id: string;
  providerTxnId: string;
  state: "open" | "matched" | "review" | "no_scan" | "ignored";
  refundedPence: number;
  amountPence: number;
}

export interface PosDb {
  updateConnection(id: string, patch: Record<string, unknown>): Promise<void>;
  // Inserts unseen sales (state per `initialState`) and returns every stored
  // row for the given provider ids, existing ones untouched.
  recordSales(
    businessId: string,
    sales: Array<SumUpSale & { initialState: "open" | "ignored" }>,
  ): Promise<StoredSale[]>;
  updateSale(id: string, patch: Record<string, unknown>): Promise<void>;
  applyRefund(saleId: string, refundedPence: number): Promise<void>;
  openSales(businessId: string): Promise<Array<{ id: string; amountPence: number; occurredAt: number }>>;
  pendingScans(businessId: string): Promise<PosScan[]>;
  setScanStatus(scanId: string, status: "expired"): Promise<void>;
  creditSale(saleId: string, scanId: string): Promise<{ ok: boolean; reason?: string }>;
  maxAutoPence(businessId: string): Promise<number>;
}

export interface SyncDeps {
  db: PosDb;
  fetch: Fetch;
  now: number;
  clientId: string;
  clientSecret: string;
}

export interface SyncSummary {
  fetched: number;
  matched: number;
  review: number;
  noScan: number;
  refunds: number;
  errors: string[];
}

const OVERLAP_MS = 5 * 60 * 1000;
const NEEDS_REFRESH_MS = 2 * 60 * 1000;

export async function syncConnection(deps: SyncDeps, conn: PosConnection): Promise<SyncSummary> {
  const { db, now } = deps;
  const summary: SyncSummary = { fetched: 0, matched: 0, review: 0, noScan: 0, refunds: 0, errors: [] };

  let accessToken = conn.accessToken;
  if (conn.tokenExpiresAt - now < NEEDS_REFRESH_MS) {
    try {
      const tokens = await refreshTokens(deps.fetch, now, deps, conn.refreshToken);
      accessToken = tokens.accessToken;
      await db.updateConnection(conn.id, {
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken || conn.refreshToken,
        token_expires_at: new Date(tokens.expiresAt).toISOString(),
      });
    } catch (error) {
      if (error instanceof SumUpError && error.code === "invalid_grant") {
        await db.updateConnection(conn.id, { status: "needs_reconnect", last_error: "SumUp access was revoked" });
      } else {
        await db.updateConnection(conn.id, { last_error: "Could not refresh SumUp access" });
      }
      summary.errors.push("token_refresh_failed");
      return summary;
    }
  }

  let sales: SumUpSale[];
  try {
    const since = new Date((conn.syncCursor ?? now) - OVERLAP_MS);
    sales = await listSales(deps.fetch, accessToken, conn.merchantCode, since);
  } catch (error) {
    const code = error instanceof SumUpError ? error.code : "history_failed";
    await db.updateConnection(conn.id, { last_error: `SumUp sync failed (${code})` });
    summary.errors.push(code);
    return summary;
  }
  summary.fetched = sales.length;

  // Record sales. Only successful pound sales can ever be credited.
  const stored = await db.recordSales(
    conn.businessId,
    sales.map((s) => ({
      ...s,
      initialState: s.status === "SUCCESSFUL" && s.currency === "GBP" ? ("open" as const) : ("ignored" as const),
    })),
  );
  const byTxn = new Map(stored.map((row) => [row.providerTxnId, row]));

  // Refunds and cancellations on sales we already know about.
  for (const sale of sales) {
    const row = byTxn.get(sale.providerTxnId);
    if (!row) continue;
    const gone = ["REFUNDED", "CANCELLED", "CHARGE_BACK"].includes(sale.status);
    const refunded = gone ? row.amountPence : Math.min(sale.refundedPence, row.amountPence);
    if (refunded <= row.refundedPence) continue;
    try {
      if (row.state === "matched") {
        await db.applyRefund(row.id, refunded);
      } else {
        await db.updateSale(row.id, {
          refunded_pence: refunded,
          provider_status: sale.status,
          ...(gone && (row.state === "open" || row.state === "review") ? { state: "ignored" } : {}),
        });
      }
      summary.refunds += 1;
    } catch {
      summary.errors.push("refund_failed");
    }
  }

  // Settle the open sales against the pending scans.
  const [open, scans, maxAutoPence] = await Promise.all([
    db.openSales(conn.businessId),
    db.pendingScans(conn.businessId),
    db.maxAutoPence(conn.businessId),
  ]);
  const matcherSales: PosSale[] = open.map((s) => ({ id: s.id, amountPence: s.amountPence, occurredAt: s.occurredAt }));

  for (const decision of matchSales(matcherSales, scans, { now, maxAutoPence })) {
    try {
      if (decision.kind === "match") {
        const result = await db.creditSale(decision.saleId, decision.scanId);
        if (result.ok) summary.matched += 1;
        else {
          // E.g. the customer left the shop's programme: a person decides.
          await db.updateSale(decision.saleId, { state: "review" });
          summary.review += 1;
        }
      } else if (decision.kind === "review") {
        await db.updateSale(decision.saleId, { state: "review" });
        summary.review += 1;
      } else if (decision.kind === "no_scan") {
        await db.updateSale(decision.saleId, { state: "no_scan" });
        summary.noScan += 1;
      } else {
        await db.setScanStatus(decision.scanId, "expired");
      }
    } catch {
      summary.errors.push("settle_failed");
    }
  }

  await db.updateConnection(conn.id, {
    last_synced_at: new Date(now).toISOString(),
    // Hold the cursor back after a failure so the next pass re-reads the batch.
    ...(summary.errors.length ? {} : { sync_cursor: new Date(now).toISOString() }),
    last_error: summary.errors.length ? "Some sales could not be processed" : null,
  });
  return summary;
}
