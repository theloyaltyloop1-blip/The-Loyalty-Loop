const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const EFFECTIVE_DATE = '23 September 2026';
const COMPANY = 'The Loyalty Loop';
const CONTACT_EMAIL = 'developer@the-loyalty-loop.com';
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
const termsSections = [
  ['1. Who these Terms apply to', [
    `These Terms of Service ("Terms") govern your access to and use of ${COMPANY}, including our website, mobile applications, and the loyalty-card services we provide (together, the "Service"). They apply to everyone who creates an account or otherwise uses the Service, whether as a customer collecting stamps or points, a business owner running a loyalty programme, a staff member working at a participating shop, or a platform administrator.`,
    'By creating an account or using the Service you agree to be bound by these Terms. If you do not agree, please do not use the Service. Business owners are additionally bound by our Merchant Agreement and Data Processing Addendum, which form part of these Terms where applicable.',
  ]],
  ["2. What the Service does", [
    "The Loyalty Loop helps local shops run loyalty programmes. We are introducing cumulative spend rewards: eligible purchases build progress towards the pound amount shown by each shop, with excess spend carried towards the next reward. Existing stamp and points programmes continue until their shop moves to spend rewards. Your shop page shows the rules that currently apply.",
    "Where card-linked earning is available, you can choose to link an eligible card through Fidel API and earn from matched GBP purchases at participating shops. This feature is being rolled out and is not available at every shop. Staff-recorded purchases are available where the shop supports them. Linking a card does not guarantee that every payment will be matched."
]],
  ['3. Accounts and eligibility', [
    'You must provide accurate information when creating an account and keep it up to date. You are responsible for maintaining the confidentiality of your password and for all activity that occurs under your account. You must be at least 16 years old to create an account. If you are creating an account on behalf of a business, you confirm that you are authorised to do so.',
    'Business owner accounts go live immediately on completing onboarding, without a manual approval step. A separate "verified" badge is available on request and is reviewed by our team, but is not required for a shop to operate.',
  ]],
  ["4. Stamps, points and rewards", [
    "Progress and rewards have no cash value, cannot be transferred between accounts and cannot be exchanged for cash. Each shop displays its reward and threshold. Reward expiry and eligibility conditions are shown in the Service. Changes do not affect rights you have under consumer law.",
    "For spend-based programmes, progress may be credited when a purchase is authorised and corrected when final payment or refund information arrives. A full or partial refund reduces progress by the refunded amount. This can make progress negative, including after a reward has been used. Redemption at that shop is paused while the balance is negative; eligible new spend restores progress and clears the pause when the balance reaches zero. Contact support if an adjustment appears wrong.",
    "Card-linked earning depends on card eligibility, an active participating location and successful payment-network matching. Some payment providers use shared merchant identifiers, so automatic earning may be unavailable. Do not submit the same purchase for both automatic and manual credit."
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
  ["13. Optional card linking", [
    "When available, card linking is optional and requires the separate consent presented in the Fidel enrolment form. Accepting these Terms, joining a shop or accepting cookies does not link a card or authorise transaction monitoring. Only link a card you are authorised to use. The supported programme is for eligible Visa, Mastercard and American Express cards, subject to the enrolment checks.",
    "Use the number on your physical card, rather than a virtual wallet card number. Up to five active cards may be linked to one account; a card cannot be linked to two shopper accounts at once. Fidel handles card entry. We do not receive your full card number or security code, and linking does not authorise us to charge your card.",
    "Where the feature is enabled, remove a card through Your account > Linked cards to stop future earning from it. We request removal from Fidel; provider processing or already-in-flight events may take time. Unlinking does not erase previous loyalty activity or cancel valid refund adjustments. Contact support if removal is unavailable or fails. Account deletion is a separate request, described in the Privacy Notice."
]],
];

const privacySections = [
  ['1. Who we are', [
    `${COMPANY} ("we", "us") is the data controller for personal data processed through the Service, except where we process data on behalf of a participating shop that acts as controller for its own members' loyalty data as described below. You can contact us about privacy matters at ${CONTACT_EMAIL}.`,
  ]],
  ["2. Information we collect", [
    "We collect account details you provide, such as your name, email, optional phone number and postcode, together with authentication information. We also process shops joined, loyalty progress, recorded spend, rewards, visits, reviews, messages, notification subscriptions and technical information needed to run and secure the Service. Device location is used when you permit it for nearby-shop features. Optional usage analytics are described in our Cookie Policy.",
    "If you choose card linking when it becomes available, Fidel collects card details directly through its secure enrolment form. We do not receive or store your full card number or card security code. We store a provider card identifier, card scheme, last four digits, link status and linking/unlinking timestamps. A random account-linking identifier associates your enrolled cards with your account.",
    "For matched transactions, Fidel sends purchase or refund identifiers, linked-card and merchant/location identifiers, amount, currency, transaction time and authorisation, clearing or refund status. We store transaction and webhook records, including provider payloads and processing outcomes, to calculate rewards, reconcile refunds, investigate failures and prevent duplicate credit. This is purchase-level data, not a list of individual basket items or access to your bank balance.",
    "For merchants, we process business and location details, payment-provider details and any merchant identifiers supplied for enrolment and transaction matching."
]],
  ["3. How we use your information", [
    "We use account and loyalty information to provide the service you request, record eligible purchases, calculate progress and rewards, apply refunds, manage redemption and answer support requests. Our legal basis for these activities is performance of our contract with you. For shop-directed processing, the shop is responsible for its own lawful basis.",
    "Optional card enrolment and transaction monitoring require your separate consent in the Fidel form. You can withdraw that consent by removing the linked card or contacting support. Withdrawal does not affect processing already carried out lawfully. Card-linking consent is separate from cookies, analytics, marketing and notification permissions.",
    "We rely on legitimate interests to keep the Service secure, investigate misuse, prevent duplicate rewards and resolve disputes, balancing these interests against your rights. We process information to comply with legal obligations where required. Optional usage analytics and consent-based promotional communications rely on your consent.",
    "Reward calculations and refund adjustments are automated using the matched amount and the shop threshold. A refund can reduce progress below zero and temporarily block redemption at that shop. You can contact support to challenge an incorrect match or adjustment and request a review."
]],
  ["4. Who we share information with", [
    "When you join a shop, its authorised owners and staff can access the member information and loyalty activity needed to operate that shop programme. This does not give them access to your full payment card details or your activity at unrelated shops.",
    "Fidel API provides optional card enrolment and card-network transaction matching. It works with the relevant payment networks, including Visa, Mastercard and American Express. We share the identifiers and programme/merchant information needed for that service and receive matched transaction events. Fidel and the networks may have their own data-protection responsibilities; their processing is described in the notices and terms provided during enrolment. Fidel publishes its privacy notice at https://www.fidelapi.com/legal/privacy.",
    "We also use cloud database, authentication and storage services, email and notification providers and optional business tools to operate the Service. We do not sell your personal data. Card linking does not give a shop permission to send you marketing without the appropriate separate permission.",
    "We may disclose information where required by law, to protect users and the Service, or as part of a business transfer with appropriate safeguards."
]],
  ['5. International transfers', [
    'Some of our service providers may process data outside the United Kingdom or European Economic Area. Where this happens, we rely on appropriate safeguards recognised under data protection law, such as standard contractual clauses, to protect your information.',
  ]],
  ["6. How long we keep your information", [
    "We keep account and loyalty data while needed to provide your account and programme. Transaction, refund and processing records are used to maintain accurate balances, investigate duplicate or missing events and resolve disputes. Retention depends on whether those purposes remain necessary and any applicable legal duties; card removal does not itself erase past activity.",
    "Where card linking is enabled, removing a card stops future earning for that link and starts its removal from Fidel. Provider removal can take time; contact support if it is not completed. You can request account deletion through Profile or support. The card-linked deletion process must remove cards at Fidel before completing deletion of the account and its linked-card and transaction records; if provider removal fails, the request remains incomplete and needs retry or support.",
    "We do not promise immediate deletion from all backups or from independently controlled merchant, Fidel or payment-network records. Any records retained to meet a specific legal obligation must be limited to that purpose. Contact us for details of retention or the progress of a deletion request."
]],
  ["7. Your rights", [
    "You may request access, correction, erasure or portability of your personal data, restriction of processing, or object to processing based on legitimate interests, subject to applicable law. You can withdraw consent for optional processing without withdrawing from unrelated features. Contact developer@the-loyalty-loop.com to exercise these rights or query automated reward adjustments.",
    "You may complain to the UK Information Commissioner at https://ico.org.uk/ or your local data-protection authority. You do not need to contact us first. Card-linked features are being rolled out; if a card-removal or deletion control is unavailable, contact support rather than assuming that closing the app stops monitoring."
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
  ["2. The categories of cookies we use", [
    "Essential browser storage keeps you signed in and remembers your privacy choice. Optional usage analytics record activity such as event name, page context and your signed-in account identifier when you choose Accept all. Essential only disables these optional usage events. These records are not anonymous because they can be associated with your account.",
    "Card-linked purchase and refund records are used to operate rewards under the Privacy Notice. They are separate from optional website usage analytics. Accepting cookies does not authorise card enrolment or transaction monitoring; choosing Essential only does not unlink an already linked card."
]],
  ["3. Managing your preferences", [
    "The banner offers Accept all or Essential only. Your choice is saved in browser local storage for that browser. To reset it, clear this site's stored data in your browser and choose again on your next visit; this may also sign you out. Different devices or browsers keep separate choices.",
    "Notification and marketing preferences are separate account controls. When card linking is available, use Linked cards to remove a card; clearing browser cookies alone does not withdraw card-monitoring consent."
]],
  ["4. Third-party cookies", [
    "Features such as authentication, maps and bot protection can connect to third-party services. Optional card linking opens Fidel's hosted enrolment form, which also processes connection and device information under its own notice. Review the terms and privacy information in that form before enrolling. The form has a separate card-linking consent; our cookie banner cannot grant it on your behalf."
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
  ["2. What we provide", [
    "We provide shop profiles, loyalty progress and reward management, staff access, customer-code lookup, analytics and customer communications subject to member preferences. We are moving shops to cumulative spend rewards with a pound threshold and staff-recorded purchases. Legacy features remain until the shop is moved; only use features currently enabled in your dashboard.",
    "We submit participating shops for Fidel card-linked earning, but enrolment alone does not mean automatic earning is active. Payment-network matching and location activation must succeed. Some payment providers use shared identifiers that prevent reliable matching; those shops use supported manual purchase entry instead."
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
  ["12. Fidel merchant enrolment and permission", [
    "By accepting this Agreement on behalf of a shop, you authorise The Loyalty Loop to submit the shop and its locations to Fidel API for card-linked rewards and to declare your consent to that enrolment. You confirm you have authority to give this permission for the business and each submitted location. We may share the business name, address, location and contact details, payment provider and merchant identifiers you supply with Fidel and the relevant card networks for matching eligible transactions.",
    "This permission covers matching purchases and refunds made by shoppers who separately consent to link their cards. It does not authorise collection of every customer's transactions, give you their full card details or replace shopper consent. Existing merchants must receive and accept this updated enrolment permission before we declare their consent to Fidel.",
    "Keep location and payment-provider details accurate and tell us if they change. Do not submit identifiers for another business or locations you do not control. Activation timing and card-network coverage are not guaranteed. You may request removal from card-linked participation through support; we will coordinate removal and explain any pending reconciliation.",
    "Only record genuine eligible purchases manually. Do not credit a payment already credited automatically. For a linked-card customer at an active card-linked shop, manual entries are for confirmed cash or unlinked-card payments, limited to three per customer per shop per day and at least 30 minutes apart when this feature is enabled. Honour valid rewards and assist with disputed purchases and refunds."
]],
];

const dpaSections = [
  ['1. Purpose of this Addendum', [
    `This Data Processing Addendum ("DPA") applies where a business ("Merchant", "Controller") uses ${COMPANY} ("Processor") to process personal data of its loyalty programme members ("Customer Personal Data") on the Merchant's behalf. It forms part of the Merchant Agreement between the parties and reflects the requirements of Article 28 of the UK/EU General Data Protection Regulation.`,
  ]],
  ['2. Subject matter and duration', [
    'The subject matter of processing is the provision of the Merchant Services described in the Merchant Agreement. Processing will continue for as long as the Merchant Agreement is in effect, and for a reasonable period afterwards as needed to return or delete Customer Personal Data in accordance with Sections 5 and 10.',
  ]],
  ["3. Nature and purpose of processing", [
    "Where acting on a Merchant's instructions, we record member loyalty activity, eligible spend, reward progress, redemptions and refund adjustments; provide authorised staff access; and send requested communications subject to member preferences. Optional card-linked transaction matching helps reconcile the Merchant's programme. The Loyalty Loop separately acts as controller for its account administration, platform security and optional card-linking relationship with shoppers, as described in the Privacy Notice."
]],
  ["4. Categories of data subjects and data", [
    "Data subjects are the Merchant's loyalty members. Data may include names and contact information, loyalty identifiers, shop membership, purchase amount/currency/time, merchant and transaction references, refund and clearing status, progress, redemption records and submitted messages or reviews. Provider card identifiers and limited card metadata support matching in the platform; this does not grant merchants access to full card numbers or security codes."
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
  ["10. Card-linking providers and deletion", [
    "Fidel API and payment networks participate in enrolment and transaction matching. Their role for each processing activity must follow the applicable provider agreement; this DPA does not label all Fidel or network processing as processing solely on the Merchant's instructions. Where a provider acts as our sub-processor for Merchant Personal Data, the obligations in Section 6 apply. Independently controlled processing is subject to that provider's own notice and lawful basis.",
    "Merchant instructions cannot override a shopper's card-linking withdrawal. Assist with correction and deletion requests, including identifying disputed transactions. On termination, we will return or delete data processed on your behalf at your choice, unless retention is legally required. Account-level card removal and deletion are handled under the Privacy Notice; ending one shop membership is not a request to delete the shopper's entire platform account."
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
  ["7. Card-linked rewards and transaction data", [
    "Do not link a card without authority, attempt to claim another shopper's card, falsify merchant enrolment permission or submit misleading payment or refund records. Do not seek duplicate credit through both card-linked and manual entries, bypass manual-entry limits, or exploit refund timing to redeem rewards you are not entitled to.",
    "Use member and transaction data only for authorised loyalty operations. Do not extract card-linked data for unrelated profiling, sell it, or request full card numbers or security codes through messages, support tickets or staff forms. Report suspected matching errors to support."
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
