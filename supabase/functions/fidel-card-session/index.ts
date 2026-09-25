import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { cardSession } from "../_shared/fidel-cards.ts";
import { serveUserCardFunction } from "../_shared/fidel-card-http.ts";

// Returns what the app needs to open Fidel's card screen. The SDK key is only
// handed out when linking is enabled (or to an admin tester) and the user has
// room for another card.
serveUserCardFunction("fidel-card-session", ({ db, userId }) =>
  cardSession({ env: (name) => Deno.env.get(name), db }, userId));
