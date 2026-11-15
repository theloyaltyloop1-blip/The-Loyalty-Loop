// Shared helpers for release announcement emails: rendering the plain-text
// body to safe HTML, and signing/verifying one-click unsubscribe links.

export const SITE_URL = "https://www.the-loyalty-loop.com";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Plain text -> HTML. Blank line separates paragraphs; consecutive lines that
// start with "- " become a bullet list. Everything is escaped, so a draft can
// never inject markup.
export function bodyToHtml(body: string): string {
  const blocks = body.replace(/\r\n/g, "\n").trim().split(/\n\s*\n/);
  return blocks
    .map((block) => {
      const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length && lines.every((l) => l.startsWith("- "))) {
        const items = lines.map((l) => `<li style="margin:0 0 6px">${escapeHtml(l.slice(2))}</li>`).join("");
        return `<ul style="margin:0 0 16px;padding-left:20px">${items}</ul>`;
      }
      return `<p style="margin:0 0 16px">${lines.map(escapeHtml).join("<br>")}</p>`;
    })
    .join("");
}

export function bodyToText(body: string, firstName: string | null, unsubscribeUrl: string): string {
  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";
  return `${greeting}\n\n${body.trim()}\n\n—\nThe Loyalty Loop\n\nDon't want product news? Unsubscribe: ${unsubscribeUrl}`;
}

export function renderEmailHtml(opts: { body: string; firstName: string | null; unsubscribeUrl: string; audience: "owners" | "shoppers" }): string {
  const greeting = opts.firstName ? `Hi ${escapeHtml(opts.firstName)},` : "Hi there,";
  const why = opts.audience === "owners"
    ? "You're receiving this because you run a shop on The Loyalty Loop."
    : "You're receiving this because you have a The Loyalty Loop account.";
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1f2430;font-size:15px;line-height:1.55">
  <div style="text-align:center;margin:0 0 24px"><img src="${SITE_URL}/logo-for-emails" alt="The Loyalty Loop" width="160" style="display:inline-block;width:160px;max-width:100%;height:auto"></div>
  <p style="margin:0 0 16px">${greeting}</p>
  ${bodyToHtml(opts.body)}
  <p style="margin:24px 0 0">The Loyalty Loop team</p>
  <img src="${SITE_URL}/mascot/email/whirl-wave.png" alt="" width="88" style="display:block;width:88px;max-width:100%;height:auto;margin:8px 0 0">
  <p style="margin:32px 0 0;color:#8a8f99;font-size:12px">${why} <a href="${escapeHtml(opts.unsubscribeUrl)}" style="color:#8a8f99">Unsubscribe from product news</a>.</p>
</div>`;
}

function b64url(bytes: ArrayBuffer): string {
  let s = "";
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// The key is derived from a server-only secret with a fixed label, so the
// token only ever means "this user may opt out of product news".
async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`product-updates-unsubscribe:v1:${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

export async function signUnsubscribe(userId: string, secret: string): Promise<string> {
  const key = await hmacKey(secret);
  return b64url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(userId)));
}

export async function verifyUnsubscribe(userId: string, token: string, secret: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(userId) || typeof token !== "string" || token.length > 100) return false;
  const expected = await signUnsubscribe(userId, secret);
  if (expected.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}

export async function unsubscribeUrl(userId: string, secret: string): Promise<string> {
  const t = await signUnsubscribe(userId, secret);
  return `${SITE_URL}/unsubscribe?u=${encodeURIComponent(userId)}&t=${encodeURIComponent(t)}`;
}

export function unsubscribeApiUrl(supabaseUrl: string, userId: string, token: string): string {
  return `${supabaseUrl}/functions/v1/product-updates-unsubscribe?u=${encodeURIComponent(userId)}&t=${encodeURIComponent(token)}`;
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
