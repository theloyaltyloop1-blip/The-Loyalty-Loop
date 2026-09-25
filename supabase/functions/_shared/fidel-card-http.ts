import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { CardLinkError, type CardDb, type DisplayCard } from "./fidel-cards.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

export function adminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new CardLinkError(500, "server_misconfigured");
  return createClient(url, key, { auth: { persistSession: false } });
}

export function cardDb(admin: SupabaseClient): CardDb {
  return {
    rpc: async (fn, args) => {
      const { data, error } = await admin.rpc(fn, args);
      return { data, error };
    },
    activeCards: async (userId) => {
      const { data, error } = await admin
        .from("linked_cards")
        .select("id, card_scheme, last_numbers, linked_at")
        .eq("user_id", userId)
        .is("unlinked_at", null)
        .order("linked_at", { ascending: true });
      if (error) throw new CardLinkError(500, "server_error");
      return (data ?? []).map((row): DisplayCard => ({
        linkedCardId: row.id,
        scheme: row.card_scheme,
        lastNumbers: row.last_numbers,
        linkedAt: row.linked_at,
      }));
    },
    isAdmin: async (userId) => {
      const { data, error } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
      return !error && data === true;
    },
  };
}

// Serves a signed-in-user card function. The user id always comes from the
// verified JWT, never from the request body.
export function serveUserCardFunction(
  name: string,
  handler: (ctx: { admin: SupabaseClient; db: CardDb; userId: string; body: unknown }) => Promise<unknown>,
) {
  Deno.serve(async (request) => {
    if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
    try {
      const token = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
      if (!token) return json({ error: "not_authenticated" }, 401);
      const admin = adminClient();
      const { data: { user }, error } = await admin.auth.getUser(token);
      if (error || !user) return json({ error: "not_authenticated" }, 401);
      const body = await request.json().catch(() => ({}));
      return json(await handler({ admin, db: cardDb(admin), userId: user.id, body }));
    } catch (error) {
      if (error instanceof CardLinkError) return json({ error: error.code }, error.status);
      console.error(`${name} failed`, error instanceof Error ? error.name : "unknown");
      return json({ error: "server_error" }, 500);
    }
  });
}
