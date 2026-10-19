// Thin SumUp client. Endpoints and fields were taken from SumUp's developer
// docs on 2026-10-19; the merchant-code lookup (/v0.1/me) is NOT confirmed in
// the official docs and must be checked against a SumUp test account.

export const SUMUP_API = "https://api.sumup.com";
export const SUMUP_SCOPES = "transactions.history user.profile_readonly";

export type Fetch = typeof fetch;

export class SumUpError extends Error {
  code: string;
  status?: number;
  constructor(code: string, message: string, status?: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export interface SumUpTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // ms since epoch
  scope: string | null;
}

export interface SumUpSale {
  providerTxnId: string;
  amountPence: number;
  currency: string;
  occurredAt: number;
  status: string; // SUCCESSFUL | CANCELLED | FAILED | REFUNDED | CHARGE_BACK
  refundedPence: number;
}

const toPence = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

export function buildAuthorizeUrl(clientId: string, redirectUri: string, state: string): string {
  const url = new URL(`${SUMUP_API}/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", SUMUP_SCOPES);
  url.searchParams.set("state", state);
  return url.toString();
}

async function tokenRequest(
  doFetch: Fetch,
  now: number,
  params: Record<string, string>,
): Promise<SumUpTokens> {
  const response = await doFetch(`${SUMUP_API}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) {
    const code = body?.error === "invalid_grant" ? "invalid_grant" : "token_failed";
    throw new SumUpError(code, `SumUp token request failed (${response.status})`, response.status);
  }
  return {
    accessToken: String(body.access_token),
    // SumUp may omit a new refresh token; the caller keeps the old one then.
    refreshToken: body.refresh_token ? String(body.refresh_token) : params.refresh_token ?? "",
    expiresAt: now + Number(body.expires_in ?? 3600) * 1000,
    scope: body.scope ? String(body.scope) : null,
  };
}

export const exchangeCode = (
  doFetch: Fetch,
  now: number,
  cfg: { clientId: string; clientSecret: string; redirectUri: string },
  code: string,
) =>
  tokenRequest(doFetch, now, {
    grant_type: "authorization_code",
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: cfg.redirectUri,
    code,
  });

export const refreshTokens = (
  doFetch: Fetch,
  now: number,
  cfg: { clientId: string; clientSecret: string },
  refreshToken: string,
) =>
  tokenRequest(doFetch, now, {
    grant_type: "refresh_token",
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    refresh_token: refreshToken,
  });

export async function fetchMerchantCode(doFetch: Fetch, accessToken: string): Promise<string> {
  const response = await doFetch(`${SUMUP_API}/v0.1/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await response.json().catch(() => ({}));
  const code = body?.merchant_profile?.merchant_code ?? body?.merchant_code;
  if (!response.ok || typeof code !== "string" || !code.trim()) {
    throw new SumUpError("merchant_lookup_failed", `SumUp profile lookup failed (${response.status})`, response.status);
  }
  return code.trim();
}

// Card-present payments changed at or after `changesSince`, following the
// pagination links SumUp returns (never constructing refs ourselves).
export async function listSales(
  doFetch: Fetch,
  accessToken: string,
  merchantCode: string,
  changesSince: Date,
  maxPages = 20,
): Promise<SumUpSale[]> {
  const base = `${SUMUP_API}/v2.1/merchants/${encodeURIComponent(merchantCode)}/transactions/history`;
  let query = new URLSearchParams({
    changes_since: changesSince.toISOString(),
    limit: "100",
    order: "ascending",
  });
  query.append("types[]", "PAYMENT");
  const sales: SumUpSale[] = [];

  for (let page = 0; page < maxPages; page += 1) {
    const response = await doFetch(`${base}?${query.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const body = await response.json().catch(() => ({}));
    if (response.status === 401) throw new SumUpError("unauthorized", "SumUp rejected the access token", 401);
    if (!response.ok) throw new SumUpError("history_failed", `SumUp history failed (${response.status})`, response.status);

    for (const item of Array.isArray(body.items) ? body.items : []) {
      const id = item.transaction_id ?? item.id;
      const when = Date.parse(item.timestamp);
      const amountPence = toPence(item.amount);
      // Outside Postgres integer range would fail the whole batch and jam the shop's sync.
      if (!id || Number.isNaN(when) || amountPence < 0 || amountPence > 2_000_000_000) continue;
      sales.push({
        providerTxnId: String(id),
        amountPence,
        currency: String(item.currency ?? "").toUpperCase(),
        occurredAt: when,
        status: String(item.status ?? "").toUpperCase(),
        refundedPence: toPence(item.refunded_amount),
      });
    }

    const next = (Array.isArray(body.links) ? body.links : []).find((l: { rel?: string }) => l.rel === "next");
    if (!next?.href) return sales;
    query = new URLSearchParams(String(next.href).replace(/^\?/, ""));
    // The link may not repeat our filter; never let refunds arrive as sales.
    if (!query.has("types[]")) query.append("types[]", "PAYMENT");
  }
  return sales;
}
