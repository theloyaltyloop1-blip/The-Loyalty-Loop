import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { claimCards } from "../_shared/fidel-cards.ts";
import { serveUserCardFunction } from "../_shared/fidel-card-http.ts";

// Stores a card only after Fidel confirms it was enrolled under this user's
// secret metadata id. With no cardId it recovers any unclaimed cards.
serveUserCardFunction("fidel-card-claim", ({ db, userId, body }) =>
  claimCards({ env: (name) => Deno.env.get(name), db, fetch }, userId, body));
