// SumUp sends the owner's browser back here after they approve access. No JWT
// is possible on a redirect, so the one-time `state` (bound to the owner and
// business that started the flow) is the authentication.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { exchangeCode, fetchMerchantCode } from "../_shared/sumup.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP = Deno.env.get("APP_BASE_URL") ?? "https://www.the-loyalty-loop.com";

const back = (result: string) =>
  new Response(null, { status: 302, headers: { Location: `${APP}/owner/settings?tab=loyalty&sumup=${result}` } });

Deno.serve(async (req: Request) => {
  if (req.method !== "GET") return new Response("method not allowed", { status: 405 });
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateId = url.searchParams.get("state");
  if (url.searchParams.get("error")) return back("denied");
  if (!code || !stateId || !/^[0-9a-f-]{36}$/i.test(stateId)) return back("error");

  const clientId = Deno.env.get("SUMUP_CLIENT_ID");
  const clientSecret = Deno.env.get("SUMUP_CLIENT_SECRET");
  if (!clientId || !clientSecret) return back("error");

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  try {
    // Consume the state first: a replayed or expired link finds nothing.
    const { data: state } = await admin
      .from("pos_oauth_states")
      .delete()
      .eq("state", stateId)
      .gt("expires_at", new Date().toISOString())
      .select("business_id, user_id")
      .maybeSingle();
    if (!state) return back("expired");

    // The person who started the flow must still own the shop.
    const { data: business } = await admin
      .from("businesses")
      .select("owner_id")
      .eq("id", state.business_id)
      .maybeSingle();
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: state.user_id, _role: "admin" });
    if (!business || (business.owner_id !== state.user_id && isAdmin !== true)) return back("error");

    const now = Date.now();
    const tokens = await exchangeCode(fetch, now, {
      clientId,
      clientSecret,
      redirectUri: `${SUPABASE_URL}/functions/v1/sumup-callback`,
    }, code);
    const merchantCode = await fetchMerchantCode(fetch, tokens.accessToken);

    const { error } = await admin.from("pos_connections").upsert({
      business_id: state.business_id,
      provider: "sumup",
      merchant_code: merchantCode,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      token_expires_at: new Date(tokens.expiresAt).toISOString(),
      scope: tokens.scope,
      status: "active",
      last_error: null,
      // Only sales from now on: nothing is back-filled from before the link.
      sync_cursor: new Date(now).toISOString(),
      connected_by: state.user_id,
    }, { onConflict: "business_id,provider" });
    if (error) return back("error");
    return back("connected");
  } catch {
    return back("error");
  }
});
