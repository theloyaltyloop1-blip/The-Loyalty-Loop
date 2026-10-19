// Decides which till sales can safely be credited to which scanned customer.
//
// The till tells us the amount and the time, never who paid. Crediting the
// wrong customer gives away money, so a sale is auto-matched only when the
// evidence is unambiguous in BOTH directions:
//   * exactly one customer scanned within the window of the sale, and
//   * that customer has exactly one sale within the window.
// Anything else waits for the owner ("review") once the window has passed.

export interface PosSale {
  id: string;
  amountPence: number;
  occurredAt: number; // ms since epoch
}

export interface PosScan {
  id: string;
  customerId: string;
  scannedAt: number; // ms since epoch
}

export interface MatchOptions {
  now: number;
  windowMs?: number; // how far apart a scan and a sale may be
  graceMs?: number; // extra wait after the window before giving up on a sale
  maxAutoPence?: number; // bigger sales always go to review
}

export type MatchDecision =
  | { kind: "match"; saleId: string; scanId: string; customerId: string }
  | { kind: "review"; saleId: string }
  | { kind: "no_scan"; saleId: string }
  | { kind: "expire_scan"; scanId: string };

export const DEFAULT_WINDOW_MS = 10 * 60 * 1000;
export const DEFAULT_GRACE_MS = 5 * 60 * 1000;

export function matchSales(sales: PosSale[], scans: PosScan[], options: MatchOptions): MatchDecision[] {
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const graceMs = options.graceMs ?? DEFAULT_GRACE_MS;
  const { now, maxAutoPence } = options;
  const near = (sale: PosSale, scan: PosScan) => Math.abs(sale.occurredAt - scan.scannedAt) <= windowMs;

  const decisions: MatchDecision[] = [];
  const usedScans = new Set<string>();

  // For each sale, the distinct customers who scanned near it; for each
  // customer, the distinct sales near their scans.
  const customersFor = new Map<string, Set<string>>();
  const salesFor = new Map<string, Set<string>>();
  for (const sale of sales) {
    for (const scan of scans) {
      if (!near(sale, scan)) continue;
      if (!customersFor.has(sale.id)) customersFor.set(sale.id, new Set());
      customersFor.get(sale.id)!.add(scan.customerId);
      if (!salesFor.has(scan.customerId)) salesFor.set(scan.customerId, new Set());
      salesFor.get(scan.customerId)!.add(sale.id);
    }
  }

  for (const sale of sales) {
    const customers = customersFor.get(sale.id);
    const settled = now >= sale.occurredAt + windowMs + graceMs;

    if (!customers || customers.size === 0) {
      // Nobody scanned. Wait out the window in case the scan comes late.
      if (settled) decisions.push({ kind: "no_scan", saleId: sale.id });
      continue;
    }

    if (customers.size === 1) {
      const customerId = [...customers][0];
      const oneSaleOnly = salesFor.get(customerId)!.size === 1;
      const withinCap = maxAutoPence === undefined || sale.amountPence <= maxAutoPence;
      if (oneSaleOnly && withinCap) {
        // Use the scan closest in time; any other scan by the same customer
        // for this sale is a duplicate and is retired with it.
        const candidates = scans
          .filter((s) => s.customerId === customerId && near(sale, s))
          .sort((a, b) => Math.abs(a.scannedAt - sale.occurredAt) - Math.abs(b.scannedAt - sale.occurredAt));
        const chosen = candidates[0];
        for (const c of candidates) usedScans.add(c.id);
        decisions.push({ kind: "match", saleId: sale.id, scanId: chosen.id, customerId });
        continue;
      }
    }

    // Ambiguous, or too large to trust: let a person decide, but only once the
    // window has passed so late scans are included in the choice.
    if (settled || now >= sale.occurredAt + windowMs) {
      decisions.push({ kind: "review", saleId: sale.id });
    }
  }

  // Scans that can no longer match anything: nothing sold near them and the
  // window has run out. Scans consumed by a match are retired by the credit.
  for (const scan of scans) {
    if (usedScans.has(scan.id)) continue;
    const expired = now >= scan.scannedAt + windowMs + graceMs;
    if (!expired) continue;
    const hasSale = sales.some((sale) => near(sale, scan));
    if (!hasSale) decisions.push({ kind: "expire_scan", scanId: scan.id });
  }

  return decisions;
}
