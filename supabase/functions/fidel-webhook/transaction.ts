import { amountStringToPence, topLevelAmountToken } from "./amount.ts";

export type FidelEventType =
  | "transaction.auth"
  | "transaction.clearing"
  | "transaction.refund";

export type FidelTransaction = {
  id: string;
  programId: string;
  cardId: string;
  locationId: string;
  originalTransactionId: string | null;
  amountPence: number;
  auth: boolean;
  cleared: boolean;
};

function nonemptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 200;
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function parseFidelTransaction(
  rawBody: string,
  eventType: FidelEventType,
): FidelTransaction {
  if (rawBody.length > 1_000_000) throw new Error("Fidel payload is too large");
  const parsed: unknown = JSON.parse(rawBody);
  if (!object(parsed)) throw new Error("Fidel payload must be an object");
  if (!nonemptyString(parsed.id) ||
      !nonemptyString(parsed.programId) ||
      parsed.currency !== "GBP" ||
      !object(parsed.card) ||
      !nonemptyString(parsed.card.id) ||
      !object(parsed.location) ||
      !nonemptyString(parsed.location.id) ||
      typeof parsed.amount !== "number" ||
      !Number.isFinite(parsed.amount) ||
      typeof parsed.auth !== "boolean" ||
      typeof parsed.cleared !== "boolean") {
    throw new Error("Fidel transaction is missing required fields");
  }
  const originalTransactionId = parsed.originalTransactionId;
  if (originalTransactionId !== undefined &&
      originalTransactionId !== null &&
      !nonemptyString(originalTransactionId)) {
    throw new Error("Fidel originalTransactionId is invalid");
  }
  const amountToken = topLevelAmountToken(rawBody);
  const amountPence = amountStringToPence(amountToken);
  if (Number(amountToken) !== parsed.amount) {
    throw new Error("Fidel amount token does not match parsed amount");
  }
  if (eventType === "transaction.auth" && (amountPence < 0 || parsed.auth !== true)) {
    throw new Error("authorization must have nonnegative amount and auth=true");
  }
  if (eventType === "transaction.refund" && (amountPence >= 0 || parsed.auth !== false)) {
    throw new Error("refund must have negative amount and auth=false");
  }
  if (eventType === "transaction.clearing" && parsed.cleared !== true) {
    throw new Error("clearing must have cleared=true");
  }
  return {
    id: parsed.id,
    programId: parsed.programId,
    cardId: parsed.card.id,
    locationId: parsed.location.id,
    originalTransactionId:
      typeof originalTransactionId === "string" ? originalTransactionId : null,
    amountPence,
    auth: parsed.auth,
    cleared: parsed.cleared,
  };
}
