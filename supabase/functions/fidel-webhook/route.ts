import type { FidelWebhookRoute } from "./handler.ts";

type EnvGet = (name: string) => string | undefined;

// Selector value in `?event=` -> environment prefix and event type. The request's
// query only chooses which configured route to try; the event type is taken from
// server configuration and authenticated by that route's own signed URL and secret.
const routes = new Map<string, [string, FidelWebhookRoute["eventType"]]>([
  ["auth", ["AUTH", "transaction.auth"]],
  ["clearing", ["CLEARING", "transaction.clearing"]],
  ["refund", ["REFUND", "transaction.refund"]],
]);

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function configuredRoute(requestUrl: string, env: EnvGet): FidelWebhookRoute | null {
  const selectors = parseUrl(requestUrl)?.searchParams.getAll("event") ?? [];
  const config = selectors.length === 1 ? routes.get(selectors[0]) : undefined;
  if (!config) return null;
  const [prefix, eventType] = config;
  const registeredUrl = env(`FIDEL_WEBHOOK_${prefix}_URL`);
  const secretKey = env(`FIDEL_WEBHOOK_${prefix}_SECRET`);
  if (!registeredUrl || !secretKey) return null;
  // The registered URL is part of the signed string, so it must name this same
  // event and be byte-for-byte canonical, or the route is treated as unconfigured.
  const registered = parseUrl(registeredUrl);
  if (!registered || registered.href !== registeredUrl || registered.protocol !== "https:" ||
      registered.search !== `?event=${selectors[0]}` || registered.hash !== "") {
    console.error("fidel-webhook route misconfigured", prefix);
    return null;
  }
  return { eventType, registeredUrl, secretKey };
}
