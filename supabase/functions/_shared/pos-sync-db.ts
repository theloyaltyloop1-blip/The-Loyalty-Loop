// Supabase-backed PosDb for the sync pass. Service role only.
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { PosDb, StoredSale } from "./pos-sync.ts";

const fail = (what: string, error: { message?: string } | null) => {
  if (error) throw new Error(`${what}: ${error.message ?? "database error"}`);
};

export function posDb(admin: SupabaseClient): PosDb {
  return {
    async updateConnection(id, patch) {
      const { error } = await admin.from("pos_connections").update(patch).eq("id", id);
      fail("updateConnection", error);
    },

    async recordSales(businessId, sales) {
      if (sales.length === 0) return [];
      const { error: insertError } = await admin.from("pos_sales").upsert(
        sales.map((s) => ({
          business_id: businessId,
          provider: "sumup",
          provider_txn_id: s.providerTxnId,
          amount_pence: s.amountPence,
          currency: s.currency,
          occurred_at: new Date(s.occurredAt).toISOString(),
          provider_status: s.status,
          state: s.initialState,
        })),
        { onConflict: "provider,provider_txn_id", ignoreDuplicates: true },
      );
      fail("recordSales", insertError);

      const { data, error } = await admin
        .from("pos_sales")
        .select("id, provider_txn_id, state, refunded_pence, amount_pence")
        .eq("business_id", businessId)
        .eq("provider", "sumup")
        .in("provider_txn_id", sales.map((s) => s.providerTxnId));
      fail("recordSales", error);
      return (data ?? []).map((row): StoredSale => ({
        id: row.id,
        providerTxnId: row.provider_txn_id,
        state: row.state,
        refundedPence: row.refunded_pence,
        amountPence: row.amount_pence,
      }));
    },

    async updateSale(id, patch) {
      const { error } = await admin.from("pos_sales").update(patch).eq("id", id);
      fail("updateSale", error);
    },

    async applyRefund(saleId, refundedPence) {
      const { error } = await admin.rpc("pos_apply_refund", {
        _sale_id: saleId,
        _refunded_pence: refundedPence,
      });
      fail("applyRefund", error);
    },

    async openSales(businessId) {
      const { data, error } = await admin
        .from("pos_sales")
        .select("id, amount_pence, occurred_at")
        .eq("business_id", businessId)
        .eq("state", "open")
        .order("occurred_at", { ascending: true });
      fail("openSales", error);
      return (data ?? []).map((row) => ({
        id: row.id,
        amountPence: row.amount_pence,
        occurredAt: Date.parse(row.occurred_at),
      }));
    },

    async pendingScans(businessId) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await admin
        .from("pos_scans")
        .select("id, customer_id, scanned_at")
        .eq("business_id", businessId)
        .eq("status", "pending")
        .gte("scanned_at", since);
      fail("pendingScans", error);
      return (data ?? []).map((row) => ({
        id: row.id,
        customerId: row.customer_id,
        scannedAt: Date.parse(row.scanned_at),
      }));
    },

    async setScanStatus(scanId, status) {
      const { error } = await admin.from("pos_scans").update({ status }).eq("id", scanId);
      fail("setScanStatus", error);
    },

    async creditSale(saleId, scanId) {
      const { error } = await admin.rpc("pos_credit_sale", {
        _sale_id: saleId,
        _scan_id: scanId,
        _resolved_by: null,
      });
      return error ? { ok: false, reason: error.message } : { ok: true };
    },

    async maxAutoPence(businessId) {
      const { data, error } = await admin
        .from("businesses")
        .select("manual_spend_max_pence")
        .eq("id", businessId)
        .single();
      fail("maxAutoPence", error);
      return data?.manual_spend_max_pence ?? 20000;
    },
  };
}
