import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { handleFidelWebhook } from "./handler.ts";
import { configuredRoute } from "./route.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

Deno.serve(async (request) => {
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("fidel-webhook missing Supabase service configuration");
    return new Response(JSON.stringify({ error: "server_misconfigured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  return handleFidelWebhook(request, {
    routeFor: (requestUrl) => configuredRoute(requestUrl, (name) => Deno.env.get(name)),
    admin,
  });
});
