const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const EFFECTIVE_DATE = '8 August 2026';
const COMPANY = 'The Loyalty Loop';
const CONTACT_EMAIL = 'legal@theloyaltyloop.example';
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
    lines.forEach((line, i) => {
      ensureSpace(14.5);
      if (i === 0) page.drawText('•', { x: MARGIN_L, y, size, font, color: DARK });
      page.drawText(line, { x: MARGIN_L + bulletIndent, y, size, font, color: DARK });
      y -= 14.5;
    });
    y -= 4;
  }

  function drawHeading(text) {
    ensureSpace(30);
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
  console.log('Wrote', outPath);
}

// ---------------------------------------------------------------------
const termsSections = [
  ['1. Who these Terms apply to', [
    `These Terms of Service ("Terms") govern your access to and use of ${COMPANY}, including our website, mobile applications, and the loyalty-card services we provide (together, the "Service"). They apply to everyone who creates an account or otherwise uses the Service, whether as a customer collecting stamps or points, a business owner running a loyalty programme, a staff member working at a participating shop, or a platform administrator.`,
    'By creating an account or using the Service you agree to be bound by these Terms. If you do not agree, please do not use the Service. Business owners are additionally bound by our Merchant Agreement and Data Processing Addendum, which form part of these Terms where applicable.',
  ]],
  ['2. What the Service does', [
    `${COMPANY} lets local shops run digital stamp, points, or visit-based loyalty programmes. Customers join a shop's loyalty card, collect stamps or points when they visit, and redeem rewards once they reach the shop's chosen threshold. Business owners get a dashboard to manage their programme, invite staff, view analytics, and communicate with their members.`,
  ]],
  ['3. Accounts and eligibility', [
    'You must provide accurate information when creating an account and keep it up to date. You are responsible for maintaining the confidentiality of your password and for all activity that occurs under your account. You must be at least 16 years old to create an account. If you are creating an account on behalf of a business, you confirm that you are authorised to do so.',
    'Business owner accounts go live immediately on completing onboarding, without a manual approval step. A separate "verified" badge is available on request and is reviewed by our team, but is not required for a shop to operate.',
  ]],
  ['4. Stamps, points and rewards', [
    'Stamps, points, tiers, and rewards issued through the Service have no cash value, are not transferable between accounts, and cannot be exchanged for cash. They may be forfeited if your account is closed, if you are found to have engaged in fraudulent activity, or in accordance with the terms set by the participating shop (for example, an expiry period on a specific reward).',
    "Each participating shop sets its own reward catalogue, thresholds, and loyalty type (stamp card, points, or visit-based tiers). We are not responsible for a shop's decision to change its rewards, and shops may cancel their programme at any time; stamps and rewards already earned at that shop may become unusable once it does so.",
  ]],
  ['5. Acceptable use', [
    'You agree not to misuse the Service. This includes, without limitation, attempting to claim stamps or rewards you have not genuinely earned, scanning or entering codes that do not belong to you, abusing the referral programme, or interfering with the proper functioning of the Service. Our full list of prohibited conduct is set out in our Acceptable Use Policy, which forms part of these Terms.',
  ]],
  ['6. Reviews and content you submit', [
    'If you leave a review, reply, or other content through the Service, you must have genuinely visited or interacted with the relevant shop where required, and your content must be honest, lawful, and not defamatory, harassing, or infringing of anyone else’s rights. We may remove content that breaches these Terms and may suspend accounts that repeatedly do so.',
    'You retain ownership of content you submit, but you grant us a licence to host, display, and distribute it as part of operating the Service (for example, showing your review to other customers of that shop).',
  ]],
  ['7. Intellectual property', [
    `The Service, including its design, branding, and underlying software, is owned by ${COMPANY} or our licensors and is protected by intellectual property laws. Nothing in these Terms transfers any of that ownership to you. You may not copy, modify, or reverse-engineer any part of the Service except as permitted by law.`,
  ]],
  ['8. Disclaimers and liability', [
    'The Service is provided "as is". We do not guarantee that it will be uninterrupted, error-free, or available at all times, and we are not responsible for the acts or omissions of participating shops, including their decisions about rewards, opening hours, or the quality of goods and services they provide.',
    `To the fullest extent permitted by law, ${COMPANY} will not be liable for any indirect, incidental, or consequential loss arising from your use of the Service. Nothing in these Terms limits liability that cannot be limited under applicable law, including liability for death or personal injury caused by negligence, or for fraud.`,
  ]],
  ['9. Suspension and termination', [
    'You may stop using the Service and request deletion of your account at any time from your profile settings. We may suspend or terminate your account if you breach these Terms, our Acceptable Use Policy, or applicable law, or if we reasonably believe your account poses a risk to the Service or other users.',
  ]],
  ['10. Changes to these Terms', [
    'We may update these Terms from time to time to reflect changes to the Service or for legal or regulatory reasons. Where a change is material, we will make reasonable efforts to notify you before it takes effect. Continued use of the Service after a change takes effect means you accept the updated Terms.',
  ]],
  ['11. Governing law', [
    `These Terms are governed by the laws of ${JURISDICTION}. Any dispute arising from these Terms or the Service will be subject to the exclusive jurisdiction of the courts of ${JURISDICTION}, unless mandatory consumer protection law in your country of residence gives you the right to bring proceedings elsewhere.`,
  ]],
  ['12. Contact us', [
    `Questions about these Terms can be sent to ${CONTACT_EMAIL}.`,
  ]],
];

const privacySections = [
  ['1. Who we are', [
    `${COMPANY} ("we", "us") is the data controller for personal data processed through the Service, except where a participating shop acts as controller for its own members' loyalty data as described below. You can contact us about privacy matters at ${CONTACT_EMAIL}.`,
  ]],
  ['2. Information we collect', [
    'We collect information you give us directly, such as your name, email address, phone number, postcode, and password when you register. We also collect information generated by using the Service, such as:',
    [
      'Your loyalty activity — shops you join, stamps or points earned, rewards redeemed, and visit history.',
      'Reviews, ratings, and messages you submit through the Service.',
      "Approximate location, if you use the map to find nearby shops (your device controls whether this is shared).",
      'Device and usage information, such as your IP address, browser type, and how you interact with the Service, including through cookies (see our Cookie Policy).',
      'A push-notification token, if you enable notifications, so we can send you updates about stamps, rewards, and offers.',
    ],
  ]],
  ['3. How we use your information', [
    'We use your information to: provide and maintain the Service (for example, tracking your stamp card progress); let you sign in and manage your account; enable participating shops to award and redeem stamps or rewards for their own members; send service messages and, where you have opted in, promotional messages from shops you have joined; maintain the security of the Service and prevent fraud; and comply with our legal obligations.',
    'Where we rely on your consent (for example, for marketing notifications or non-essential cookies), you can withdraw that consent at any time through your account settings.',
  ]],
  ['4. Who we share information with', [
    "When you join a shop's loyalty card, that shop (and staff it has authorised) can see your loyalty activity at their shop — this is how the Service works. Shops do not see your activity at other shops.",
    'We also share limited personal data with service providers who help us run the Service, acting under our instructions and only for the purposes we specify. These currently include our cloud database and authentication provider, our transactional and marketing email provider, and, where a shop owner chooses to use them, optional AI-assisted business tools. We do not sell your personal data.',
    'We may disclose information where required by law, to protect the rights and safety of our users, or in connection with a merger, acquisition, or sale of assets, subject to appropriate safeguards.',
  ]],
  ['5. International transfers', [
    'Some of our service providers may process data outside the United Kingdom or European Economic Area. Where this happens, we rely on appropriate safeguards recognised under data protection law, such as standard contractual clauses, to protect your information.',
  ]],
  ['6. How long we keep your information', [
    'We keep your personal data for as long as your account is active, and for a reasonable period afterwards to comply with legal obligations, resolve disputes, and enforce our agreements. If you delete your account, we delete or anonymise your personal data within a reasonable time, except where we are required to retain it (for example, financial records a business owner must keep).',
  ]],
  ['7. Your rights', [
    'Depending on where you live, you may have the right to access, correct, delete, or export your personal data, to object to or restrict certain processing, and to lodge a complaint with your local data protection authority. You can access and update most of your information directly from your account, and you can request full account deletion from your Profile settings at any time.',
  ]],
  ['8. Cookies', [
    'We use cookies and similar technologies as described in our Cookie Policy, which forms part of this Privacy Notice.',
  ]],
  ['9. Children', [
    'The Service is not directed at children under 16, and we do not knowingly collect personal data from them. If you believe a child has provided us with personal data, please contact us and we will take appropriate steps to remove it.',
  ]],
  ['10. Changes to this notice', [
    'We may update this Privacy Notice from time to time. If we make material changes, we will notify you through the Service or by email before they take effect.',
  ]],
  ['11. Contact us', [
    `For any privacy question or to exercise your rights, contact us at ${CONTACT_EMAIL}.`,
  ]],
];

const cookieSections = [
  ['1. What cookies are', [
    'Cookies are small text files placed on your device when you visit a website or use an app. Similar technologies include local storage and push-notification tokens, which we refer to collectively as "cookies" in this policy.',
  ]],
  ['2. The categories of cookies we use', [
    [
      'Necessary — required for the Service to function, such as keeping you signed in and remembering your cookie preferences. These cannot be switched off.',
      'Analytics — help us understand how the Service is used so we can improve it, such as which pages are visited and how often. These are only set with your consent.',
      'Marketing — used to measure the effectiveness of promotional messages and, where applicable, personalise offers. These are only set with your consent.',
    ],
  ]],
  ['3. Managing your preferences', [
    'You can choose which categories of non-essential cookies to allow when the cookie banner first appears, and you can change your choice at any time from your account or browser settings. If you decline analytics or marketing cookies, the Service will still work, but we will have less information to improve it and you may see less relevant offers.',
    'Your consent choice is versioned: if we materially change how we use cookies, we will ask you to confirm your preferences again.',
  ]],
  ['4. Third-party cookies', [
    'Some cookies are set by trusted third parties who provide services to us, such as authentication, maps, and bot protection on our sign-up forms. These providers may use cookies for their own purposes subject to their own privacy policies.',
  ]],
  ['5. Changes to this policy', [
    'We may update this Cookie Policy from time to time to reflect changes in the technologies we use. We will update the effective date at the top of this document when we do.',
  ]],
  ['6. Contact us', [
    `Questions about our use of cookies can be sent to ${CONTACT_EMAIL}.`,
  ]],
];

const merchantSections = [
  ['1. Scope of this Agreement', [
    `This Merchant Agreement applies in addition to our general Terms of Service and governs your use of ${COMPANY} to operate a digital loyalty programme for your business (the "Merchant Services"). By creating a business owner account, you agree to this Agreement on behalf of the business you represent.`,
  ]],
  ['2. What we provide', [
    'We provide a platform that lets you set up a shop profile, configure a stamp, points, or visit-based loyalty programme, invite and manage staff with permission-based access, scan or manually enter customer codes to award stamps and redeem rewards, view analytics about your members, and send win-back and promotional messages to members who have opted in.',
    'Your shop goes live immediately on completing onboarding. A "verified" badge, based on proof-of-business documents you may choose to submit, is reviewed separately and is not required for your shop to operate.',
  ]],
  ['3. Your responsibilities', [
    [
      'Provide accurate information about your business, including your address, category, and contact details, and keep it up to date.',
      'Honour the rewards and thresholds you configure for genuine, eligible customers.',
      'Set staff permissions responsibly and revoke access promptly when a staff member leaves.',
      'Only contact your members with promotional messages where they have not opted out, and comply with applicable marketing and electronic communications law.',
      "Use customer data made available to you through the Service only to operate your loyalty programme, and in accordance with our Data Processing Addendum where you act as a data controller for your own members' loyalty data.",
    ],
  ]],
  ['4. Fees', [
    'Any fees applicable to your use of the Merchant Services will be presented to you separately at sign-up or in your dashboard. Where no fee is shown, the current core Merchant Services are provided free of charge. We will give you reasonable advance notice before introducing or changing fees for your shop.',
  ]],
  ['5. No lock-in', [
    'You may deactivate or cancel your shop at any time from your dashboard, with no minimum term and no cancellation fee. Once deactivated, your shop will no longer be visible to customers and new stamps or rewards can no longer be issued; existing customer records are handled in accordance with our Privacy Notice and Data Processing Addendum.',
  ]],
  ['6. Verification and compliance', [
    'We may ask you to submit proof-of-business documents to obtain a verified badge, and may review or request further information at any time to ensure shops on the platform are genuine and comply with applicable law. We may decline or revoke a verified badge, or suspend a shop, if we reasonably believe this Agreement or applicable law has been breached.',
  ]],
  ['7. Branding and intellectual property', [
    `You retain ownership of your shop's name, logo, and content you upload. You grant ${COMPANY} a licence to display this material to customers as part of operating the Service. You must have the right to use any material you upload.`,
  ]],
  ['8. Liability', [
    `${COMPANY} is not responsible for disputes between you and your customers regarding rewards, product quality, or service at your shop. To the fullest extent permitted by law, our liability to you under this Agreement is limited to the fees you have paid us for the Merchant Services in the twelve months before the claim arose, except for liability that cannot be limited by law.`,
  ]],
  ['9. Termination', [
    'Either party may terminate this Agreement at any time as described in Section 5. We may also suspend or terminate your access immediately if you materially breach this Agreement, our Terms of Service, or applicable law.',
  ]],
  ['10. Governing law', [
    `This Agreement is governed by the laws of ${JURISDICTION} and is subject to the exclusive jurisdiction of the courts of ${JURISDICTION}.`,
  ]],
  ['11. Contact us', [
    `Questions about this Agreement can be sent to ${CONTACT_EMAIL}.`,
  ]],
];

const dpaSections = [
  ['1. Purpose of this Addendum', [
    `This Data Processing Addendum ("DPA") applies where a business ("Merchant", "Controller") uses ${COMPANY} ("Processor") to process personal data of its loyalty programme members ("Customer Personal Data") on the Merchant's behalf. It forms part of the Merchant Agreement between the parties and reflects the requirements of Article 28 of the UK/EU General Data Protection Regulation.`,
  ]],
  ['2. Subject matter and duration', [
    'The subject matter of processing is the provision of the Merchant Services described in the Merchant Agreement. Processing will continue for as long as the Merchant Agreement is in effect, and for a reasonable period afterwards as needed to return or delete Customer Personal Data in accordance with Section 7.',
  ]],
  ['3. Nature and purpose of processing', [
    "We process Customer Personal Data to operate the loyalty programme the Merchant configures — recording stamps, points, and reward redemptions; enabling staff the Merchant has authorised to scan or look up customers; storing reviews and messages; and sending communications the Merchant requests, subject to each customer's own preferences.",
  ]],
  ['4. Categories of data subjects and data', [
    "Data subjects are the Merchant's loyalty programme members. The categories of Customer Personal Data processed typically include name, email address, phone number, a unique loyalty code, transaction and visit history, reward status, and any review content or messages the customer submits in relation to the Merchant's shop.",
  ]],
  ['5. Processor obligations', [
    [
      "Process Customer Personal Data only on the Merchant's documented instructions, as reflected in the configuration and features the Merchant selects, unless required to do otherwise by law.",
      'Ensure personnel authorised to process Customer Personal Data are subject to confidentiality obligations.',
      'Implement appropriate technical and organisational security measures, including access controls enforced at the database level, encryption of stored credentials such as staff PINs, and role-based permissions for staff scanning and redemption actions.',
      "Assist the Merchant, where reasonably possible, in responding to data subject requests and in meeting its obligations relating to data protection impact assessments and consultations with regulators.",
      'Notify the Merchant without undue delay after becoming aware of a personal data breach affecting Customer Personal Data.',
      "At the Merchant's choice, delete or return Customer Personal Data at the end of the provision of Merchant Services, except where retention is required by law.",
      "Make available information reasonably necessary to demonstrate compliance with this DPA and allow for audits, including inspections, conducted by the Merchant or an auditor it appoints, subject to reasonable notice and confidentiality.",
    ],
  ]],
  ['6. Sub-processors', [
    `The Merchant authorises ${COMPANY} to engage sub-processors to provide the Merchant Services, including our cloud database, authentication, and storage provider; our transactional email provider used for win-back and receipt-style emails; and, only where the Merchant actively enables them, optional AI-assisted analytics or research features. We remain responsible for our sub-processors' compliance with data protection obligations equivalent to those in this DPA, and we will give the Merchant reasonable notice of any intended change so it may object on reasonable grounds.`,
  ]],
  ['7. International transfers', [
    'Where a sub-processor is located outside the UK or EEA, we ensure an appropriate transfer mechanism is in place, such as standard contractual clauses or an adequacy decision.',
  ]],
  ['8. Liability', [
    "Each party's liability under this DPA is subject to the limitations of liability set out in the Merchant Agreement.",
  ]],
  ['9. Contact us', [
    `Questions about this DPA can be sent to ${CONTACT_EMAIL}.`,
  ]],
];

const aupSections = [
  ['1. Purpose', [
    `This Acceptable Use Policy explains what you must not do when using ${COMPANY}. It applies to every account holder — customers, business owners, staff, and administrators — and forms part of our Terms of Service.`,
  ]],
  ['2. Prohibited activities', [
    'You must not:',
    [
      "Attempt to claim, award, or redeem stamps, points, or rewards you are not genuinely entitled to, including by sharing, guessing, or brute-forcing another customer's loyalty code or QR code.",
      "Create multiple accounts to abuse sign-up rewards, the referral programme, or a shop's loyalty programme.",
      'Use automated means (bots, scrapers, or scripts) to access the Service, extract data, or interact with shops or other users, except where we have explicitly permitted this.',
      'Attempt to circumvent rate limits, security controls, or access restrictions built into the Service.',
      "Access or attempt to access another user's account, or any part of the Service you are not authorised to use, including as a staff member acting outside your granted permissions.",
      "Submit reviews, replies, announcements, or messages that are false, defamatory, harassing, hateful, obscene, or otherwise unlawful.",
      "Upload malicious code, or content that infringes someone else's intellectual property or privacy rights.",
      'Use the Service to send unsolicited marketing to people who have not consented to receive it.',
      'Reverse-engineer, decompile, or attempt to extract the source code of the Service, except where permitted by law.',
      'Use the Service in any way that could disable, overburden, damage, or impair it, or interfere with any other party’s use of it.',
    ],
  ]],
  ['3. Business owner and staff responsibilities', [
    "Business owners are additionally responsible for the actions of staff accounts they create, and must revoke a staff member's access promptly once that person is no longer authorised to act on the business's behalf. Staff members must only scan, redeem, or respond to reviews within the permissions granted to them, and must not share their password or PIN with anyone else.",
  ]],
  ['4. Reporting a problem', [
    `If you believe someone is misusing the Service, or you have found a security issue, please contact us at ${CONTACT_EMAIL} as soon as possible so we can investigate.`,
  ]],
  ['5. Consequences of breach', [
    'We may remove content, suspend or restrict features, or terminate accounts that breach this policy, with or without notice depending on the severity of the breach. We may also take legal action or report unlawful activity to the relevant authorities where appropriate.',
  ]],
  ['6. Changes to this policy', [
    'We may update this policy from time to time. Continued use of the Service after an update takes effect means you accept the revised policy.',
  ]],
];

(async () => {
  await buildPdf('terms-of-service.pdf', 'Terms of Service', termsSections);
  await buildPdf('privacy-notice.pdf', 'Privacy Notice', privacySections);
  await buildPdf('cookie-policy.pdf', 'Cookie Policy', cookieSections);
  await buildPdf('merchant-agreement.pdf', 'Merchant Agreement', merchantSections);
  await buildPdf('data-processing-addendum.pdf', 'Data Processing Addendum', dpaSections);
  await buildPdf('acceptable-use-policy.pdf', 'Acceptable Use Policy', aupSections);
  console.log('Done.');
})();
