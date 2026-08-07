import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Owner invites staff by email: sets the initial password directly (staff
// signs in immediately, no self-registration/confirmation loop). Re-inviting
// a previously revoked email reuses the same auth account and resets their
// password rather than erroring. Needs the Auth Admin API (service role),
// which is why this can't just be a plain RPC.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405, headers: jsonHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace("Bearer ", "");
    const authed = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await authed.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: jsonHeaders });
    }
    const callerId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const businessId = body.business_id as string | undefined;
    const email = (body.email as string | undefined)?.trim().toLowerCase();
    const name = (body.name as string | undefined)?.trim();
    const password = body.password as string | undefined;
    const permissions = body.permissions as
      | { can_scan_stamps?: boolean; can_redeem_rewards?: boolean; can_respond_reviews?: boolean }
      | undefined;

    if (!businessId || !email || !name || !password) {
      return new Response(JSON.stringify({ error: "business_id, email, name and password are required" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }
    if (password.length < 8) {
      return new Response(JSON.stringify({ error: "password must be at least 8 characters" }), { status: 400, headers: jsonHeaders });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: business, error: bizErr } = await admin
      .from("businesses")
      .select("id, owner_id")
      .eq("id", businessId)
      .single();
    if (bizErr || !business) {
      return new Response(JSON.stringify({ error: "business not found" }), { status: 404, headers: jsonHeaders });
    }
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: callerId, _role: "admin" });
    if (business.owner_id !== callerId && !isAdmin) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: jsonHeaders });
    }

    // Does this business already have a staff_members row for this email
    // (active or revoked)? Re-inviting reuses the same auth account.
    const { data: existingStaffRow } = await admin
      .from("staff_members")
      .select("id, user_id, status")
      .eq("business_id", businessId)
      .eq("invited_email", email)
      .maybeSingle();

    let staffUserId: string;

    if (existingStaffRow?.user_id) {
      // Reuse the existing auth account, reset its password.
      const { error: updateErr } = await admin.auth.admin.updateUserById(existingStaffRow.user_id, {
        password,
        user_metadata: { first_name: name },
      });
      if (updateErr) throw updateErr;
      staffUserId = existingStaffRow.user_id;
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { first_name: name },
      });

      if (createErr) {
        const alreadyExists = createErr.message?.toLowerCase().includes("already been registered") || createErr.status === 422;
        if (!alreadyExists) throw createErr;

        // Account exists under another context — look it up via profiles.email
        // (kept in sync by handle_new_user) and reuse it, still resetting the
        // password since the owner is the one setting staff credentials.
        const { data: existingProfile, error: profileErr } = await admin
          .from("profiles")
          .select("id")
          .eq("email", email)
          .maybeSingle();
        if (profileErr || !existingProfile) {
          return new Response(JSON.stringify({ error: "An account with this email already exists and could not be resolved." }), {
            status: 409,
            headers: jsonHeaders,
          });
        }
        const { error: updateErr } = await admin.auth.admin.updateUserById(existingProfile.id, { password });
        if (updateErr) throw updateErr;
        staffUserId = existingProfile.id;
      } else {
        staffUserId = created.user.id;
      }
    }

    await admin
      .from("user_roles")
      .upsert({ user_id: staffUserId, role: "staff" }, { onConflict: "user_id,role", ignoreDuplicates: true });

    const { data: staffRow, error: upsertErr } = await admin
      .from("staff_members")
      .upsert(
        {
          business_id: businessId,
          invited_email: email,
          user_id: staffUserId,
          name,
          status: "active",
          invited_by: callerId,
          activated_at: new Date().toISOString(),
          can_scan_stamps: permissions?.can_scan_stamps ?? true,
          can_redeem_rewards: permissions?.can_redeem_rewards ?? true,
          can_respond_reviews: permissions?.can_respond_reviews ?? false,
        },
        { onConflict: "business_id,invited_email" }
      )
      .select()
      .single();
    if (upsertErr) throw upsertErr;

    return new Response(JSON.stringify({ staff: staffRow }), { headers: jsonHeaders });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "internal error" }), { status: 500, headers: jsonHeaders });
  }
});
