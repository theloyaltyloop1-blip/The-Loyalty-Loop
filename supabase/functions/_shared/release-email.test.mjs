import assert from "node:assert/strict";
import { test } from "node:test";
import { bodyToHtml, renderEmailHtml, signUnsubscribe, verifyUnsubscribe, unsubscribeUrl, chunk } from "./release-email.ts";

const UID = "11111111-2222-3333-4444-555555555555";
const OTHER = "99999999-2222-3333-4444-555555555555";

test("body is escaped, split into paragraphs and bullet lists", () => {
  const html = bodyToHtml("Big news <script>x</script>\nline two\n\n- one & two\n- three");
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("<br>line two"));
  assert.ok(html.includes("<ul"));
  assert.ok(html.includes("<li style=\"margin:0 0 6px\">one &amp; two</li>"));
});

test("greeting name is escaped and footer has unsubscribe link", () => {
  const html = renderEmailHtml({ body: "Hi", firstName: "<b>Sam</b>", unsubscribeUrl: "https://x/u?a=1&b=2", audience: "shoppers" });
  assert.ok(html.includes("Hi &lt;b&gt;Sam&lt;/b&gt;,"));
  assert.ok(html.includes("href=\"https://x/u?a=1&amp;b=2\""));
  assert.ok(html.includes("Unsubscribe from product news"));
});

test("unsubscribe token verifies only for the same user and secret", async () => {
  const t = await signUnsubscribe(UID, "secret-a");
  assert.equal(await verifyUnsubscribe(UID, t, "secret-a"), true);
  assert.equal(await verifyUnsubscribe(OTHER, t, "secret-a"), false);
  assert.equal(await verifyUnsubscribe(UID, t, "secret-b"), false);
  assert.equal(await verifyUnsubscribe(UID, t.slice(0, -1) + (t.endsWith("A") ? "B" : "A"), "secret-a"), false);
  assert.equal(await verifyUnsubscribe("not-a-uuid", t, "secret-a"), false);
});

test("unsubscribe url points at the website page", async () => {
  const url = await unsubscribeUrl(UID, "s");
  assert.ok(url.startsWith("https://www.the-loyalty-loop.com/unsubscribe?u=" + UID + "&t="));
});

test("chunk splits into batches of 100", () => {
  const parts = chunk(Array.from({ length: 250 }, (_, i) => i), 100);
  assert.deepEqual(parts.map((p) => p.length), [100, 100, 50]);
});
