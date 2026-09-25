import { verifyFidelSignature } from "./signature.ts";
import { parseFidelTransaction, type FidelEventType } from "./transaction.ts";

export type FidelRpcClient = {
  rpc: (functionName: string, args: Record<string, unknown>) => Promise<{
    data: { status?: unknown } | null;
    error: { code?: string; message?: string } | null;
  }>;
};

export type FidelWebhookRoute = {
  eventType: FidelEventType;
  registeredUrl: string;
  secretKey: string;
};

export type FidelWebhookDependencies = {
  routeFor: (requestUrl: string) => FidelWebhookRoute | null;
  admin: FidelRpcClient;
};

function response(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function eventMessageId(request: Request): string | null {
  const value = request.headers.get("fidel-message-id");
  return value && value.length <= 200 && value.trim() ? value : null;
}

// The request's event selector chooses a server-configured route. Its event type
// is authenticated using that route's registered URL and event-specific secret;
// the runtime request URL is never used as the signed URL.
export async function handleFidelWebhook(
  request: Request,
  dependencies: FidelWebhookDependencies,
): Promise<Response> {
  if (request.method !== "POST") return response({ error: "method_not_allowed" }, 405);

  const route = dependencies.routeFor(request.url);
  if (!route) return response({ error: "unconfigured_webhook_route" }, 404);

  const rawBody = await request.text();
  const signatureIsValid = await verifyFidelSignature({
    rawBody,
    webhookUrl: route.registeredUrl,
    timestamp: request.headers.get("x-fidel-timestamp"),
    signature: request.headers.get("x-fidel-signature"),
    secretKey: route.secretKey,
  });
  if (!signatureIsValid) return response({ error: "invalid_signature" }, 401);

  const messageId = eventMessageId(request);
  if (!messageId) return response({ error: "missing_fidel_message_id" }, 400);

  try {
    const transaction = parseFidelTransaction(rawBody, route.eventType);
    const { data, error } = await dependencies.admin.rpc("process_fidel_webhook_event", {
      _fidel_message_id: messageId,
      _event_type: route.eventType,
      _fidel_transaction_id: transaction.id,
      _program_id: transaction.programId,
      _fidel_card_id: transaction.cardId,
      _fidel_location_id: transaction.locationId,
      _original_transaction_id: transaction.originalTransactionId,
      _amount_pence: transaction.amountPence,
      _auth: transaction.auth,
      _cleared: transaction.cleared,
    });
    if (error) {
      console.error(
        "fidel-webhook rpc failed",
        error.code ?? "unknown",
        error.message ?? "no diagnostic message",
      );
      return response({ error: "processing_failed" }, 500);
    }

    const outcome = typeof data?.status === "string" ? data.status : "invalid_rpc_response";
    if (outcome === "unknown_merchant" || outcome === "unknown_card" ||
        outcome === "unknown_membership" || outcome === "unresolved_refund" ||
        outcome === "unresolved_clearing" || outcome === "invalid_refund") {
      console.warn("fidel-webhook reconciliation required", outcome);
    }
    if (outcome === "invalid_refund") {
      return response({ status: outcome }, 400);
    }
    return response({ status: outcome });
  } catch (error) {
    console.warn("fidel-webhook malformed payload", error instanceof Error ? error.message : "unknown");
    return response({ error: "malformed_payload" }, 400);
  }
}
