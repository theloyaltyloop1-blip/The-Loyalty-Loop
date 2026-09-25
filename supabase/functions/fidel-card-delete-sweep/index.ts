import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { CardLinkError, sweepPendingDeletes } from "../_shared/fidel-cards.ts";
import { adminClient, cardDb } from "../_shared/fidel-card-http.ts";

const encoder = new TextEncoder();

function sameSecret(expected: string, received: string): boolean {
  const left = encoder.encode(expected);
  const right = encoder.encode(received);
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

// Retries Fidel deletion for unlinked cards. Service role only: called by a
// scheduled job, never by the app.
Deno.serve(async (request) => {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const token = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (request.method !== "POST" || !serviceKey || !sameSecret(serviceKey, token)) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
  }
  try {
    const admin = adminClient();
    const result = await sweepPendingDeletes({ env: (name) => Deno.env.get(name), db: cardDb(admin), fetch });
    return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    const code = error instanceof CardLinkError ? error.code : "server_error";
    console.error("fidel-card-delete-sweep failed", code);
    return new Response(JSON.stringify({ error: code }), { status: 500 });
  }
});
