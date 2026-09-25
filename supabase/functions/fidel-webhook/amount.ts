const maxPence = 2_147_483_647n;
const minPence = -2_147_483_648n;

export function amountStringToPence(value: string): number {
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value)) {
    throw new Error("Fidel amount must have at most two decimal places");
  }
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = (negative ? value.slice(1) : value).split(".");
  const magnitude = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  const pence = negative ? -magnitude : magnitude;
  if (pence < minPence || pence > maxPence) {
    throw new Error("Fidel amount exceeds database integer range");
  }
  return Number(pence);
}

// Fidel's transaction webhook body is a JSON object. Read the original
// top-level number token so JSON.parse cannot round a monetary value first.
export function topLevelAmountToken(rawBody: string): string {
  let objectDepth = 0;
  let arrayDepth = 0;
  let found: string | null = null;
  for (let index = 0; index < rawBody.length; index += 1) {
    const character = rawBody[index];
    if (character === '"') {
      const start = index;
      index += 1;
      while (index < rawBody.length) {
        if (rawBody[index] === "\\") {
          index += 2;
          continue;
        }
        if (rawBody[index] === '"') break;
        index += 1;
      }
      if (index >= rawBody.length) throw new Error("invalid JSON string");
      if (objectDepth === 1 && arrayDepth === 0) {
        const key = JSON.parse(rawBody.slice(start, index + 1));
        let next = index + 1;
        while (/\s/.test(rawBody[next] ?? "")) next += 1;
        if (key === "amount" && rawBody[next] === ":") {
          if (found !== null) throw new Error("duplicate top-level amount");
          next += 1;
          while (/\s/.test(rawBody[next] ?? "")) next += 1;
          const token = rawBody.slice(next).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
          if (!token) throw new Error("amount must be a JSON number");
          found = token[0];
        }
      }
      continue;
    }
    if (character === "{") objectDepth += 1;
    else if (character === "}") objectDepth -= 1;
    else if (character === "[") arrayDepth += 1;
    else if (character === "]") arrayDepth -= 1;
  }
  if (found === null) throw new Error("top-level amount is missing");
  return found;
}
