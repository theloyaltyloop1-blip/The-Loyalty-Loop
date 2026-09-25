import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { unlinkCard } from "../_shared/fidel-cards.ts";
import { serveUserCardFunction } from "../_shared/fidel-card-http.ts";

// Stops earning immediately, then deletes the card at Fidel (retried by the
// sweep if Fidel is unavailable).
serveUserCardFunction("fidel-card-unlink", ({ db, userId, body }) =>
  unlinkCard({ env: (name) => Deno.env.get(name), db, fetch }, userId, body));
