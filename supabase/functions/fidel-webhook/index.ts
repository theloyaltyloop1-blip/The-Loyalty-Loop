import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { handleFidelWebhook } from "./handler.ts";
import { configuredRoute } from "./route.ts";
import { sendPendingPushes } from "../_shared/push.ts";
import { supabasePushStore } from "../_shared/push-store.ts";

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
    // A credited purchase notifies its customer in the background, after the
    // response to Fidel, so a slow push service can't delay the webhook.
    onProcessed: ({ eventType, fidelTransactionId }) => {
      if (eventType !== "transaction.auth") return;
      const task = (async () => {
        const { data } = await admin
          .from("fidel_transactions")
          .select("user_id,business_id")
          .eq("fidel_transaction_id", fidelTransactionId)
          .maybeSingle();
        if (data) await sendPendingPushes(supabasePushStore(admin), fetch, data.user_id, data.business_id);
      })().catch((error) => {
        console.error("fidel-webhook push failed", error instanceof Error ? error.message : "unknown");
      });
      // Keep the runtime alive until the push finishes; the task runs either way.
      (globalThis as { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } })
        .EdgeRuntime?.waitUntil(task);
    },
  });
});
