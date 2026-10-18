import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { deleteShopAndFiles } from "./cleanup.ts";
const cors = { "Access-Control-Allow-Origin": "https://www.the-loyalty-loop.com", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return json({ error: "Not authenticated" }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data: { user }, error: authError } = await admin.auth.getUser(authorization.slice(7));
    if (authError || !user) return json({ error: "Not authenticated" }, 401);
    const { business_id, confirmation_name } = await req.json();
    if (typeof business_id !== "string" || !/^[0-9a-f-]{36}$/i.test(business_id) || typeof confirmation_name !== "string") return json({ error: "Invalid shop or confirmation" }, 400);
    const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const { data: shop, error: lookupError } = await admin.from("businesses").select("owner_id,name,verification_document_path").eq("id", business_id).single();
    if (lookupError || !shop) return json({ error: "Shop not found" }, 404);
    const { data: isAdmin, error: roleError } = await caller.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (roleError) throw roleError;
    if (shop.owner_id !== user.id && !isAdmin) return json({ error: "Not permitted" }, 403);
    if (shop.name !== confirmation_name.trim()) return json({ error: "Shop name does not match" }, 400);
    // Never trust a stored path as service-role deletion authority.
    const documentPath = shop.verification_document_path;
    if (documentPath && (!documentPath.startsWith(`${shop.owner_id}/${business_id}-`) || documentPath.includes('..'))) {
      return json({ error: "Verification document path needs support review before deletion" }, 400);
    }
    // Never remove files until the caller-authorized RPC has succeeded.
    const leftovers = await deleteShopAndFiles(admin.storage, business_id, shop.verification_document_path, async () => {
      const { error } = await caller.rpc("delete_owned_business", { _business_id: business_id, _confirmation_name: confirmation_name.trim() });
      if (error) throw error;
    });
    if (leftovers.length) console.error("Deleted shop storage leftovers", business_id, leftovers);
    return json({ deleted: true, leftovers });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : (error as { message?: string })?.message ?? "Shop deletion failed" }, 400);
  }
});
