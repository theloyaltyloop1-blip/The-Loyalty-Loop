// NOT RUN. Optional one-off: pick AI card colours for existing shops that have a logo
// but no designed card (card_design is null). Dry run by default.
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/backfill-card-colours.mjs [--apply]
// Calls the suggest-card-colour function as the service role, then writes brand_color
// and card_design. Shops with a card_design already are never touched.
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
const apply = process.argv.includes("--apply");
const h = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

const rows = await (await fetch(`${url}/rest/v1/businesses?select=id,name,category,logo_url&card_design=is.null&logo_url=not.is.null`, { headers: h })).json();
console.log(`${rows.length} shops with a logo and no card design`);
for (const b of rows) {
  // The function checks the caller is the owner or an admin, so the service role (no user) is
  // rejected; run this with an admin user's access token in SUPABASE_USER_JWT instead.
  const jwt = process.env.SUPABASE_USER_JWT;
  if (!jwt) throw new Error("Set SUPABASE_USER_JWT to an admin user's access token");
  const r = await fetch(`${url}/functions/v1/suggest-card-colour`, { method: "POST", headers: { ...h, Authorization: `Bearer ${jwt}` }, body: JSON.stringify({ business_id: b.id }) });
  const c = await r.json();
  if (!r.ok || c.source === "default") { console.log("skip", b.name, c.error ?? c.source); continue; }
  console.log(apply ? "set " : "would set", b.name, c.background, c.secondary, c.source);
  if (!apply) continue;
  const design = { version: 1, background: "solid", color: c.background, secondary: c.secondary, icon: "star", font: "modern", layout: "grid", entrance: "stamp", logoPosition: "left", photo: null };
  await fetch(`${url}/rest/v1/businesses?id=eq.${b.id}&card_design=is.null`, { method: "PATCH", headers: { ...h, Prefer: "return=minimal" }, body: JSON.stringify({ brand_color: c.background, card_design: design }) });
}
