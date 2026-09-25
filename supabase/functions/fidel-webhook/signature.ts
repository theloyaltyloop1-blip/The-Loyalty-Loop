const encoder = new TextEncoder();
const toleranceMs = 5 * 60 * 1000;

function base64(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

function constantTimeEqual(expected: string, received: string): boolean {
  const left = encoder.encode(expected);
  const right = encoder.encode(received);
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

export async function fidelSignature(
  rawBody: string,
  webhookUrl: string,
  timestamp: string,
  secretKey: string,
): Promise<string> {
  if (!secretKey || !webhookUrl) throw new Error("Fidel webhook configuration is missing");
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secretKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const first = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(rawBody + webhookUrl + timestamp),
  );
  const second = await crypto.subtle.sign("HMAC", key, encoder.encode(base64(first)));
  return base64(second);
}

export async function verifyFidelSignature(input: {
  rawBody: string;
  webhookUrl: string;
  timestamp: string | null;
  signature: string | null;
  secretKey: string;
  nowMs?: number;
}): Promise<boolean> {
  const { rawBody, webhookUrl, timestamp, signature, secretKey } = input;
  if (!timestamp || !signature || !/^\d{13}$/.test(timestamp)) return false;
  const timestampMs = Number(timestamp);
  const nowMs = input.nowMs ?? Date.now();
  if (!Number.isSafeInteger(timestampMs) || Math.abs(nowMs - timestampMs) > toleranceMs) {
    return false;
  }
  if (!secretKey || !webhookUrl) return false;
  const expected = await fidelSignature(rawBody, webhookUrl, timestamp, secretKey);
  return constantTimeEqual(expected, signature);
}
