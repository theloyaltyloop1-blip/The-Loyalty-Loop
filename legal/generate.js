const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const EFFECTIVE_DATE = '6 October 2026';
const COMPANY = 'The Loyalty Loop';
const CONTACT_EMAIL = 'help@the-loyalty-loop.com';
const JURISDICTION = 'England and Wales';

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN_L = 62;
const MARGIN_R = 62;
const MARGIN_TOP = 70;
const MARGIN_BOTTOM = 56;
const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R;

const ORANGE = rgb(0.788, 0.384, 0.180); // #C9622E
const DARK = rgb(0.102, 0.102, 0.102); // #1a1a1a
const GREY = rgb(0.42, 0.42, 0.42);

function wrapText(text, font, size, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let current = '';
  for (const word of words) {
    const trial = current ? current + ' ' + word : word;
    if (font.widthOfTextAtSize(trial, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = trial;
    }
  }
  if (current) lines.push(current);
  return lines;
}

async function buildPdf(filename, docTitle, sections) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(docTitle);
  pdfDoc.setAuthor(COMPANY);

  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN_TOP;

  function newPage() {
    page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN_TOP;
  }

  function ensureSpace(neededHeight) {
    if (y - neededHeight < MARGIN_BOTTOM) newPage();
  }

  function drawParagraph(text, { size = 10.5, font = regular, color = DARK, lineHeight = 15, spaceAfter = 9, indent = 0 } = {}) {
    const lines = wrapText(text, font, size, CONTENT_W - indent);
    // Keep ordinary paragraphs together to avoid single-line spillovers.
    if (lines.length * lineHeight < PAGE_H - MARGIN_TOP - MARGIN_BOTTOM) {
      ensureSpace(lines.length * lineHeight);
    }
    for (const line of lines) {
      ensureSpace(lineHeight);
      page.drawText(line, { x: MARGIN_L + indent, y, size, font, color });
      y -= lineHeight;
    }
    y -= spaceAfter;
  }

  function drawBullet(text, opts = {}) {
    const size = opts.size || 10.5;
    const font = regular;
    const bulletIndent = 14;
    const lines = wrapText(text, font, size, CONTENT_W - bulletIndent - 10);
    ensureSpace(lines.length * 14.5);
    lines.forEach((line, i) => {
      ensureSpace(14.5);
      if (i === 0) page.drawText('•', { x: MARGIN_L, y, size, font, color: DARK });
      page.drawText(line, { x: MARGIN_L + bulletIndent, y, size, font, color: DARK });
      y -= 14.5;
    });
    y -= 4;
  }

  function drawHeading(text) {
    ensureSpace(66);
    y -= 6;
    page.drawText(text, { x: MARGIN_L, y, size: 13, font: bold, color: ORANGE });
    y -= 20;
  }

  // Title block
  page.drawText(docTitle, { x: MARGIN_L, y, size: 22, font: bold, color: DARK });
  y -= 26;
  const subtitle = `Effective ${EFFECTIVE_DATE} · ${COMPANY}`;
  page.drawText(subtitle, { x: MARGIN_L, y, size: 9.5, font: regular, color: GREY });
  y -= 12;
  page.drawLine({ start: { x: MARGIN_L, y }, end: { x: PAGE_W - MARGIN_R, y }, thickness: 0.75, color: rgb(0.85, 0.8, 0.72) });
  y -= 22;

  for (const [heading, items] of sections) {
    const first = Array.isArray(items[0]) ? items[0][0] : items[0];
    const firstHeight = wrapText(first, regular, 10.5, CONTENT_W - 24).length * 15;
    ensureSpace(26 + firstHeight);
    drawHeading(heading);
    for (const item of items) {
      if (Array.isArray(item)) {
        for (const bullet of item) drawBullet(bullet);
      } else {
        drawParagraph(item);
      }
    }
  }

  // Footer page numbers
  const pages = pdfDoc.getPages();
  pages.forEach((p, idx) => {
    p.drawText(`${docTitle} — Page ${idx + 1} of ${pages.length}`, {
      x: MARGIN_L,
      y: 28,
      size: 8,
      font: regular,
      color: GREY,
    });
  });

  const bytes = await pdfDoc.save();
  const outPath = path.join(__dirname, filename);
  fs.writeFileSync(outPath, bytes);
  const publicDir = path.join(__dirname, '../apps/web/public/legal');
  fs.mkdirSync(publicDir, { recursive: true });
  fs.writeFileSync(path.join(publicDir, filename), bytes);
  console.log('Wrote and synced', filename);
}

// ---------------------------------------------------------------------
// Document text lives in documents-*.js, adapted from General Legal's CC0 legal-templates.
const CREDIT = 'Adapted from open legal templates published by General Legal, PC (https://github.com/General-Legal/legal-templates, CC0 1.0) and tailored to the law of England and Wales and to how The Loyalty Loop works. The original templates are general reference material only and are not legal advice; General Legal has not reviewed this version.';
const ctx = { COMPANY, CONTACT_EMAIL, JURISDICTION, CREDIT };
const { termsSections, aupSections } = require('./documents-terms.js')(ctx);
const { privacySections, cookieSections } = require('./documents-privacy.js')(ctx);
const { merchantSections, dpaSections } = require('./documents-merchant.js')(ctx);

(async () => {
  await buildPdf('terms-of-service.pdf', 'Terms of Service', termsSections);
  await buildPdf('privacy-notice.pdf', 'Privacy Notice', privacySections);
  await buildPdf('cookie-policy.pdf', 'Cookie Policy', cookieSections);
  await buildPdf('merchant-agreement.pdf', 'Merchant Agreement', merchantSections);
  await buildPdf('data-processing-addendum.pdf', 'Data Processing Addendum', dpaSections);
  await buildPdf('acceptable-use-policy.pdf', 'Acceptable Use Policy', aupSections);
  console.log('Done.');
})();
