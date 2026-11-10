import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";
import Anthropic from "npm:@anthropic-ai/sdk";
import {
  applyRules, DECISION_SCHEMA, DECISION_SYSTEM, decisionPrompt, EXTRACTION_SCHEMA, EXTRACTION_SYSTEM,
  finalDecision, normaliseCompanyNumber, normaliseVatNumber, parseAiDecision, parseExtraction,
  type AiDecision, type Extraction, type RegisterResult, type Route, type RulesInput,
} from "../_shared/business-verification.ts";

// Automatic business verification. The owner uploads a document and calls
// submit_business_verification (shop -> 'pending'), then calls this function.
//   1. Claude reads the document into set fields (it never decides here).
//   2. Companies House is checked when COMPANIES_HOUSE_API_KEY is set.
//   3. Code rules decide; only unclear cases go to a second Claude call.
//   4. The result is recorded, and applied by apply_business_verification
//      only when business_verification_settings.mode = 'live'.
// Body: { business_id: uuid, route: 'company' | 'vat' | 'sole_trader' }
// Reply: { decision, message, mode }
// Never log document contents or extracted fields: only ids and decisions.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const COMPANIES_HOUSE_API_KEY = Deno.env.get("COMPANIES_HOUSE_API_KEY");
const MODEL = Deno.env.get("VERIFY_CLAUDE_MODEL") ?? "claude-opus-5-5";
// Optional second reader for comparison in shadow mode (images only).
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const GROQ_VISION_MODEL = Deno.env.get("GROQ_VISION_MODEL");

const BUCKET = "owner_verification_docs";
const MAX_CHECKS_PER_DAY = 5;
const PURGE_AFTER_DAYS = 90;
const ROUTES: Route[] = ["company", "vat", "sole_trader"];
const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", pdf: "application/pdf" };

const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": LOCAL_ORIGIN.test(origin) ? origin : "https://www.the-loyalty-loop.com",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

const PENDING_MESSAGE = "Thanks. We're checking your document and will let you know.";

Deno.serve(async (req: Request) => {
  const cors = corsFor(req);
  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return reply({ error: "method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: userData, error: userErr } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userErr || !userData?.user) return reply({ error: "unauthorized" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const businessId = typeof body.business_id === "string" ? body.business_id : "";
    const route = ROUTES.includes(body.route) ? (body.route as Route) : null;
    if (!/^[0-9a-f-]{36}$/i.test(businessId) || !route) return reply({ error: "business_id and route are required" }, 400);

    const { data: shop } = await admin
      .from("businesses")
      .select("id, owner_id, name, postcode, verification_status")
      .eq("id", businessId)
      .maybeSingle();
    if (!shop || shop.owner_id !== userId) return reply({ error: "not your business" }, 403);

    const { data: priv } = await admin
      .from("business_private")
      .select("verification_document_path")
      .eq("business_id", businessId)
      .maybeSingle();
    const documentPath: string | null = priv?.verification_document_path ?? null;
    // The bucket policy only lets owners write under their own id; check it again here.
    if (!documentPath || !documentPath.startsWith(`${userId}/`)) return reply({ error: "upload a document first" }, 400);

    const { data: modeRow } = await admin.from("business_verification_settings").select("mode").maybeSingle();
    const mode: "shadow" | "live" = modeRow?.mode === "live" ? "live" : "shadow";

    // Same document again: return the earlier result instead of paying twice.
    const { data: earlier } = await admin
      .from("business_verification_checks")
      .select("id, decision, owner_message")
      .eq("business_id", businessId)
      .eq("document_path", documentPath)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (earlier) return reply(ownerReply(mode, earlier.decision, earlier.owner_message));

    if (shop.verification_status !== "pending") return reply({ error: "submit the document first" }, 409);

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await admin
      .from("business_verification_checks")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .gte("created_at", since);
    if ((count ?? 0) >= MAX_CHECKS_PER_DAY) {
      return reply({ error: "You've tried a few times today. Please try again tomorrow, or contact support." }, 429);
    }

    const record = async (row: Record<string, unknown>) => {
      const { data, error } = await admin
        .from("business_verification_checks")
        .insert({ business_id: businessId, owner_id: userId, document_path: documentPath, route, mode, model: MODEL, ...row })
        .select("id")
        .single();
      if (error) throw error;
      const { error: applyErr } = await admin.rpc("apply_business_verification", { _check_id: data.id });
      if (applyErr) throw applyErr;
      console.log(JSON.stringify({ check: data.id, business: businessId, decision: row.decision, by: row.decided_by, mode }));
      return data.id as string;
    };

    if (!ANTHROPIC_API_KEY) {
      await record({ decision: "needs_review", decided_by: "error", reasons: ["ai_not_configured"] });
      return reply(ownerReply(mode, "needs_review", null));
    }

    const file = await admin.storage.from(BUCKET).download(documentPath);
    if (file.error || !file.data) {
      await record({ decision: "needs_review", decided_by: "error", reasons: ["document_download_failed"] });
      return reply(ownerReply(mode, "needs_review", null));
    }
    const ext = documentPath.split(".").pop()?.toLowerCase() ?? "";
    const mime = MIME[ext] ?? file.data.type;
    if (!Object.values(MIME).includes(mime)) return reply({ error: "Upload a PNG, JPEG, WEBP or PDF." }, 400);
    const bytes = new Uint8Array(await file.data.arrayBuffer());

    const claude = new Anthropic({ apiKey: ANTHROPIC_API_KEY, timeout: 60_000, maxRetries: 1 });

    let extraction: Extraction;
    try {
      extraction = parseExtraction(await askClaude(claude, EXTRACTION_SYSTEM, documentBlock(bytes, mime), "Fill in the form for this document.", EXTRACTION_SCHEMA, "low"));
    } catch (e) {
      console.error(JSON.stringify({ business: businessId, step: "extract", error: String(e).slice(0, 200) }));
      await record({ decision: "needs_review", decided_by: "error", reasons: ["extraction_failed"] });
      return reply(ownerReply(mode, "needs_review", null));
    }

    // A second reader, for comparison only, while in shadow mode.
    let extractionAlt: unknown = null;
    if (mode === "shadow" && GROQ_API_KEY && GROQ_VISION_MODEL) {
      extractionAlt = mime === "application/pdf"
        ? { skipped: "pdf_not_supported" }
        : await askGroq(bytes, mime).catch((e) => ({ error: String(e).slice(0, 200) }));
    }

    const companyNumber = route === "company" ? normaliseCompanyNumber(extraction.company_number) : null;
    const vatNumber = normaliseVatNumber(extraction.vat_number);
    const duplicateNumber = await isDuplicate(admin, businessId, companyNumber, vatNumber);
    const register = await lookUpRegister(route, companyNumber);

    const input: RulesInput = {
      route, extraction, register, duplicateNumber, today: new Date(),
      shop: { name: shop.name, postcode: shop.postcode },
    };
    const rules = applyRules(input);

    let ai: AiDecision | null = null;
    if (rules.kind === "ask_ai") {
      try {
        ai = parseAiDecision(await askClaude(claude, DECISION_SYSTEM, documentBlock(bytes, mime), decisionPrompt(input, rules.reasons), DECISION_SCHEMA, "high"));
      } catch (e) {
        console.error(JSON.stringify({ business: businessId, step: "decide", error: String(e).slice(0, 200) }));
        await record({
          decision: "needs_review", decided_by: "error", reasons: [...rules.reasons, "ai_decision_failed"],
          company_number: companyNumber, vat_number: vatNumber, extraction, extraction_alt: extractionAlt,
          register_result: register, register_checked: register.source !== "none",
        });
        return reply(ownerReply(mode, "needs_review", null));
      }
    }

    const final = finalDecision(input, rules, ai);
    await record({
      decision: final.decision, decided_by: final.decidedBy, reasons: final.reasons, owner_message: final.ownerMessage,
      company_number: final.decision === "approved" ? companyNumber : null,
      vat_number: final.decision === "approved" ? vatNumber : null,
      extraction, extraction_alt: extractionAlt, register_result: register, ai_decision: ai,
      register_checked: final.registerChecked, spot_check: final.spotCheck,
    });

    // Read back: apply_business_verification may have turned an approval into a
    // rejection (a number verified elsewhere at the same moment).
    const { data: latest } = await admin
      .from("business_verification_checks")
      .select("decision, owner_message")
      .eq("business_id", businessId)
      .eq("document_path", documentPath)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    await purgeOldDocuments(admin).catch((e) => console.error(JSON.stringify({ step: "purge", error: String(e).slice(0, 200) })));
    return reply(ownerReply(mode, latest?.decision ?? final.decision, latest?.owner_message ?? final.ownerMessage));
  } catch (e) {
    console.error(JSON.stringify({ step: "unhandled", error: String(e).slice(0, 300) }));
    return reply({ error: "Something went wrong checking your document. Please try again." }, 500);
  }
});

function ownerReply(mode: "shadow" | "live", decision: string, message: string | null) {
  // In shadow mode nothing is applied, so owners always hear that a person will check.
  if (mode === "shadow" || decision === "needs_review") return { decision: "pending", message: PENDING_MESSAGE, mode };
  return { decision, message: message ?? PENDING_MESSAGE, mode };
}

// deno-lint-ignore no-explicit-any
type ContentBlock = any;

function documentBlock(bytes: Uint8Array, mime: string): ContentBlock {
  const data = encodeBase64(bytes);
  return mime === "application/pdf"
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
    : { type: "image", source: { type: "base64", media_type: mime as "image/png" | "image/jpeg" | "image/webp", data } };
}

async function askClaude(
  claude: Anthropic,
  system: string,
  document: ContentBlock,
  text: string,
  schema: unknown,
  effort: "low" | "high",
): Promise<string> {
  const response = await claude.beta.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system,
    betas: ["server-side-fallback-2026-07-01"],
    // A refused request is retried on another model inside the same call.
    fallbacks: "default",
    output_config: { effort, format: { type: "json_schema", schema } },
    messages: [{ role: "user", content: [document, { type: "text", text }] }],
  // deno-lint-ignore no-explicit-any
  } as any);
  if (response.stop_reason === "refusal") throw new Error("model refused");
  if (response.stop_reason === "max_tokens") throw new Error("model ran out of tokens");
  const out = response.content.find((b: { type: string }) => b.type === "text") as { text?: string } | undefined;
  if (!out?.text) throw new Error("no text in response");
  return out.text;
}

async function askGroq(bytes: Uint8Array, mime: string): Promise<unknown> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GROQ_VISION_MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `${EXTRACTION_SYSTEM}\n\nAnswer with one JSON object with exactly these keys: ${EXTRACTION_SCHEMA.required.join(", ")}.` },
        { role: "user", content: [
          { type: "text", text: "Fill in the form for this document." },
          { type: "image_url", image_url: { url: `data:${mime};base64,${encodeBase64(bytes)}` } },
        ] },
      ],
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`groq ${res.status}`);
  const json = await res.json();
  return parseExtraction(json.choices?.[0]?.message?.content ?? "");
}

async function isDuplicate(admin: SupabaseClient, businessId: string, company: string | null, vat: string | null): Promise<boolean> {
  for (const [column, value] of [["verified_company_number", company], ["verified_vat_number", vat]] as const) {
    if (!value) continue;
    const { count } = await admin
      .from("business_private")
      .select("business_id", { count: "exact", head: true })
      .eq(column, value)
      .neq("business_id", businessId);
    if ((count ?? 0) > 0) return true;
  }
  return false;
}

async function lookUpRegister(route: Route, companyNumber: string | null): Promise<RegisterResult> {
  if (route !== "company") return { source: "none", reason: route === "vat" ? "vat_register_not_connected" : "sole_trader" };
  if (!COMPANIES_HOUSE_API_KEY) return { source: "none", reason: "companies_house_key_missing" };
  if (!companyNumber) return { source: "none", reason: "no_company_number_on_document" };
  try {
    const res = await fetch(`https://api.company-information.service.gov.uk/company/${companyNumber}`, {
      headers: { Authorization: `Basic ${btoa(`${COMPANIES_HOUSE_API_KEY}:`)}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 404) return { source: "companies_house", found: false, number: companyNumber };
    if (!res.ok) return { source: "none", reason: `companies_house_${res.status}` };
    const c = await res.json();
    return {
      source: "companies_house", found: true, number: companyNumber,
      name: String(c.company_name ?? ""), status: String(c.company_status ?? "unknown"),
      postcode: c.registered_office_address?.postal_code ?? null,
    };
  } catch {
    return { source: "none", reason: "companies_house_unreachable" };
  }
}

/** Delete documents 90 days after a final decision. Extracted fields are kept. */
async function purgeOldDocuments(admin: SupabaseClient) {
  const before = new Date(Date.now() - PURGE_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: old } = await admin
    .from("business_verification_checks")
    .select("id, business_id, document_path")
    .is("document_purged_at", null)
    .lt("created_at", before)
    .limit(20);
  for (const row of old ?? []) {
    const { data: b } = await admin.from("businesses").select("verification_status").eq("id", row.business_id).maybeSingle();
    if (b?.verification_status === "pending") continue; // still waiting on a decision
    await admin.storage.from(BUCKET).remove([row.document_path]);
    await admin.from("business_private").update({ verification_document_path: null })
      .eq("business_id", row.business_id).eq("verification_document_path", row.document_path);
    await admin.from("business_verification_checks").update({ document_purged_at: new Date().toISOString() }).eq("id", row.id);
  }
}
