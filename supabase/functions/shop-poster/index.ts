import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "npm:pdf-lib@1.17.1";
import QRCode from "npm:qrcode@1.5.4";

// Public (verify_jwt = false). GET ?slug=<shop slug> -> printable A4 PDF of the
// shop's "scan to join" QR poster. The Business app opens this URL so owners
// can print or share the poster from their phone (phone print/share sheet),
// without going to the website. It only shows what the public shop page
// already shows: name, category, logo and the join link.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE = "https://www.the-loyalty-loop.com";
// Mirrors apps/web/src/lib/features.ts WHATSAPP_VISIBLE.
const WHATSAPP_VISIBLE = true;

const W = 595.28; // A4 in points
const H = 841.89;

function hexToRgb(hex: string | null | undefined) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? "");
  const n = parseInt(m ? m[1] : "062B6B", 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

// Standard PDF fonts only cover Latin-1. Drop anything else rather than fail.
function safe(font: PDFFont, text: string): string {
  try {
    font.encodeText(text);
    return text;
  } catch {
    return [...text].filter((ch) => {
      try { font.encodeText(ch); return true; } catch { return false; }
    }).join("").trim();
  }
}

function centred(page: PDFPage, font: PDFFont, text: string, y: number, size: number, color = rgb(0.1, 0.13, 0.22), maxWidth = W - 120) {
  let s = size;
  const t = safe(font, text);
  while (s > 10 && font.widthOfTextAtSize(t, s) > maxWidth) s -= 1;
  page.drawText(t, { x: (W - font.widthOfTextAtSize(t, s)) / 2, y, size: s, font, color });
}

async function fetchImage(pdf: PDFDocument, url: string | null): Promise<PDFImage | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length > 5_000_000) return null;
    if (bytes[0] === 0x89 && bytes[1] === 0x50) return await pdf.embedPng(bytes);
    if (bytes[0] === 0xff && bytes[1] === 0xd8) return await pdf.embedJpg(bytes);
    return null; // webp/svg etc: fall back to the monogram
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method !== "GET") return new Response("method not allowed", { status: 405 });
  try {
    const slug = new URL(req.url).searchParams.get("slug") ?? "";
    if (!/^[a-z0-9-]{1,120}$/i.test(slug)) return new Response("shop not found", { status: 404 });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: shop } = await admin
      .from("businesses")
      .select("name, slug, logo_url, brand_color, category, whatsapp_onboarding_enabled, is_active")
      .eq("slug", slug)
      .maybeSingle();
    if (!shop || shop.is_active === false) return new Response("shop not found", { status: 404 });

    const joinUrl = WHATSAPP_VISIBLE && shop.whatsapp_onboarding_enabled
      ? `${SITE}/whatsapp/start?shop=${encodeURIComponent(shop.slug)}`
      : `${SITE}/dashboard/shop/${shop.slug}`;
    const whatsapp = WHATSAPP_VISIBLE && !!shop.whatsapp_onboarding_enabled;
    const brand = hexToRgb(shop.brand_color);
    const ink = rgb(0.1, 0.13, 0.22);
    const muted = rgb(0.4, 0.42, 0.48);

    const pdf = await PDFDocument.create();
    pdf.setTitle(`${shop.name} – QR poster`);
    pdf.setCreator("The Loyalty Loop");
    const page = pdf.addPage([W, H]);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const regular = await pdf.embedFont(StandardFonts.Helvetica);

    // Frame and top band in the shop's colour.
    page.drawRectangle({ x: 24, y: 24, width: W - 48, height: H - 48, borderColor: brand, borderWidth: 6 });
    page.drawRectangle({ x: 24, y: H - 48, width: W - 48, height: 24, color: brand });

    centred(page, bold, "The Loyalty Loop", H - 92, 16, muted);

    // Logo or monogram.
    const logo = await fetchImage(pdf, shop.logo_url);
    const logoY = H - 210;
    if (logo) {
      const s = Math.min(96 / logo.width, 96 / logo.height);
      page.drawImage(logo, { x: (W - logo.width * s) / 2, y: logoY, width: logo.width * s, height: logo.height * s });
    } else {
      page.drawCircle({ x: W / 2, y: logoY + 48, size: 48, color: brand });
      const letter = safe(bold, (shop.name || "?").charAt(0).toUpperCase()) || "?";
      page.drawText(letter, { x: W / 2 - bold.widthOfTextAtSize(letter, 44) / 2, y: logoY + 32, size: 44, font: bold, color: rgb(1, 1, 1) });
    }

    centred(page, bold, "LOCAL LOYALTY REWARDS", H - 240, 12, brand);
    centred(page, bold, shop.name || "Our shop", H - 285, 38, ink);
    centred(page, regular, `${shop.category ? `${shop.category} · ` : ""}Collect rewards when you visit`, H - 315, 15, muted);

    // QR code, drawn as vector squares so it prints sharp at any size.
    const qr = QRCode.create(joinUrl, { errorCorrectionLevel: "H" });
    const n: number = qr.modules.size;
    const quiet = 4;
    const qrSize = 300;
    const cell = qrSize / (n + quiet * 2);
    const qx = (W - qrSize) / 2;
    const qy = H - 650;
    page.drawRectangle({ x: qx, y: qy, width: qrSize, height: qrSize, color: rgb(1, 1, 1) });
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (qr.modules.get(r, c)) {
          page.drawRectangle({ x: qx + (c + quiet) * cell, y: qy + qrSize - (r + quiet + 1) * cell, width: cell + 0.2, height: cell + 0.2, color: rgb(0, 0, 0) });
        }
      }
    }

    centred(page, bold, whatsapp ? "Scan to join with WhatsApp" : "Scan to join and start collecting", 150, 22, ink);
    centred(page, regular, whatsapp ? "No app download required · Start in WhatsApp" : "No app download required · Your rewards stay in one place", 124, 13, muted);
    centred(page, bold, "1  Scan          2  Join          3  Earn rewards", 80, 15, brand);

    const bytes = await pdf.save();
    return new Response(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${shop.slug}-qr-poster.pdf"`,
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (e) {
    console.error(e);
    return new Response("could not make the poster", { status: 500 });
  }
});
