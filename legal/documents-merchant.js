// Merchant Agreement and Data Processing Addendum.
// Structure and wording adapted from General Legal's "Master Services
// Agreement" (warranties, liability, confidentiality, indemnity, term and
// general provisions) and "Data Processing Addendum (Global)" templates (CC0
// 1.0, https://github.com/General-Legal/legal-templates), converted to the law
// of England and Wales and UK GDPR Article 28. The U.S. state-law annex, Swiss
// provisions and EU SCC population were removed because merchants and The
// Loyalty Loop are UK-based; UK restricted-transfer mechanisms are referenced
// instead. Fidel enrolment, spend-reward and manual-entry terms are carried over.

module.exports = function (ctx) {
  const { COMPANY, CONTACT_EMAIL, JURISDICTION, CREDIT } = ctx;

  const merchantSections = [
    ['1. Scope and definitions', [
      `This Merchant Agreement applies in addition to our Terms of Service and governs your use of ${COMPANY} to operate a digital loyalty programme for your business (the "Merchant Services"). By creating a business owner account, you agree to this Agreement on behalf of the business you represent ("you", "Merchant") and confirm that you have authority to do so. If there is a conflict between this Agreement and the Terms of Service about the Merchant Services, this Agreement prevails. Our Data Processing Addendum forms part of this Agreement.`,
      '"Members" means the customers who join your shop\'s loyalty programme. "Merchant Data" means the information you or your staff put into the Merchant Services, such as shop details, rewards and thresholds, and staff records.',
    ]],
    ['2. What we provide', [
      'We provide shop profiles, loyalty progress and reward management, staff access, customer-code lookup, analytics and customer communications subject to member preferences. We are moving shops to cumulative spend rewards with a pound threshold and staff-recorded purchases. Legacy features remain until the shop is moved; only use features currently enabled in your dashboard.',
      'We submit participating shops for Fidel card-linked earning, but enrolment alone does not mean automatic earning is active. Payment-network matching and location activation must succeed. Some payment providers use shared identifiers that prevent reliable matching; those shops use supported manual purchase entry instead.',
      'We provide the Merchant Services with reasonable care and skill. We may update, improve or change features from time to time, and will give reasonable notice where a change materially reduces the Merchant Services you rely on. We do not promise that the Merchant Services will be uninterrupted or error-free, and we are not responsible for the third-party services (such as Fidel, payment networks and device or internet providers) that the Merchant Services depend on.',
    ]],
    ['3. Your responsibilities', [
      [
        'Provide accurate information about your business, including your address, category and contact details, and keep it up to date.',
        'Honour the rewards and thresholds you configure for genuine, eligible customers.',
        'Set staff permissions responsibly, keep log-in details and staff PINs confidential, and revoke access promptly when a staff member leaves. You are responsible for activity under your accounts and your staff accounts.',
        'Only contact your members with promotional messages where they have not opted out, and comply with applicable marketing and electronic communications law (including the Privacy and Electronic Communications Regulations).',
        "Use customer data made available to you through the Service only to operate your loyalty programme, and in accordance with our Data Processing Addendum where you act as a data controller for your own members' loyalty data.",
        'Comply with all laws that apply to your business and your use of the Merchant Services, and do not use the Merchant Services in breach of our Acceptable Use Policy.',
        'Make sure you own, or have the right to use, the content you upload (such as your name and logo).',
      ],
    ]],
    ['4. Fees', [
      'Any fees applicable to your use of the Merchant Services will be presented to you separately at sign-up or in your dashboard. Where no fee is shown, the current core Merchant Services are provided free of charge. We will give you reasonable advance notice before introducing or changing fees for your shop, and you may cancel before the change takes effect. Fees are stated exclusive of VAT, which is added where it applies.',
    ]],
    ['5. No lock-in', [
      'You may deactivate or cancel your shop at any time from your dashboard, with no minimum term and no cancellation fee. Once deactivated, your shop will no longer be visible to customers and new stamps or rewards can no longer be issued; existing customer records are handled in accordance with our Privacy Notice and Data Processing Addendum.',
    ]],
    ['6. Verification and compliance', [
      'We may ask you to submit proof-of-business documents to obtain a verified badge, and may review or request further information at any time to ensure shops on the platform are genuine and comply with applicable law. We may decline or revoke a verified badge, or suspend a shop, if we reasonably believe this Agreement or applicable law has been breached.',
    ]],
    ['7. Branding and intellectual property', [
      `You keep ownership of your shop's name, logo and content you upload. You grant ${COMPANY} a non-exclusive, worldwide, royalty-free licence to host and display this material to customers as part of operating the Service for as long as your shop is active. We and our licensors own the Merchant Services, the platform, its software and documentation. This Agreement does not transfer ownership to you, and you may not copy, reverse-engineer or resell any part of the Merchant Services.`,
      'If you send us feedback or suggestions, we may use them freely to improve the Merchant Services without payment or credit.',
      'We may use aggregated and anonymised information about use of the Service, which does not identify you, your members or any individual, to operate, analyse and improve the Service.',
    ]],
    ['8. Confidentiality', [
      'Each party will keep confidential any non-public information of the other that is marked confidential or that a reasonable person would understand to be confidential (such as business plans and non-public pricing), use it only to perform or receive the Merchant Services, and not disclose it except to staff, advisers and service providers who need to know and are bound by similar duties, or where the law requires. This does not apply to information that is or becomes public through no fault of the recipient, was already known to the recipient, was independently developed, or was lawfully received from a third party. Personal data is handled under our Privacy Notice and Data Processing Addendum.',
    ]],
    ['9. Warranties and disclaimers', [
      'Each party confirms that it has authority to enter into this Agreement. You confirm that the information you give us is accurate and that you have the right to give us the Merchant Data and the permissions in section 14.',
      'Except as stated in this Agreement, and to the fullest extent permitted by law, we give no other warranties or conditions, express or implied, including about uninterrupted operation, or that card-network matching will be successful at any given time. Nothing in this section excludes any warranty or condition that cannot lawfully be excluded.',
    ]],
    ['10. Liability', [
      `Nothing in this Agreement limits or excludes either party's liability for death or personal injury caused by negligence, fraud or fraudulent misrepresentation, or anything else that cannot be limited or excluded by law. Subject to that, ${COMPANY} is not responsible for disputes between you and your customers regarding rewards, product quality or service at your shop.`,
      `Subject to the paragraph above, and to the extent permitted by law: (a) neither party is liable for loss of profit, goodwill or revenue, or for indirect or consequential loss; and (b) our total liability to you arising from this Agreement in any 12-month period is limited to the greater of £100 and the fees you have paid us for the Merchant Services in the twelve months before the claim arose.`,
    ]],
    ['11. Indemnity', [
      `You will compensate ${COMPANY} for losses, damages and reasonable costs arising from a third-party claim caused by: (a) content you upload infringing someone's rights; (b) your breach of law or of section 14; or (c) your misuse of member data. We will tell you promptly of any claim, let you control its defence (with our reasonable help at your cost) and not settle it without your consent, which will not be unreasonably withheld.`,
    ]],
    ['12. Term and termination', [
      'This Agreement starts when you accept it and continues until ended. Either party may end it at any time as described in section 5. We may also suspend or terminate your access immediately if you materially breach this Agreement, our Terms of Service or applicable law, or if we are required to by law or a payment-network or card-linking provider. Sections that by their nature should continue (including confidentiality, liability, indemnity and governing law) survive termination.',
    ]],
    ['13. Changes, notices and general', [
      [
        'Changes. We may update this Agreement for legal, regulatory or service reasons. We will give reasonable notice of material changes, and you may cancel under section 5 if you do not agree.',
        'Notices. We may give notices by email or in your dashboard. You may give notice to ' + CONTACT_EMAIL + '.',
        'Entire agreement. This Agreement, with the Terms of Service, Data Processing Addendum, Acceptable Use Policy and Privacy Notice, is the whole agreement about the Merchant Services. If part is invalid, the rest continues. Failure to enforce a right is not a waiver. Neither party may transfer this Agreement without the other\'s consent, except that we may transfer it to a successor to the Service. Neither party is liable for failure caused by events beyond its reasonable control.',
        'Third-party rights. No one other than the parties may enforce this Agreement under the Contracts (Rights of Third Parties) Act 1999.',
        `Governing law. This Agreement is governed by the laws of ${JURISDICTION}, and the courts of ${JURISDICTION} have exclusive jurisdiction.`,
        'Contact. Questions about this Agreement can be sent to ' + CONTACT_EMAIL + '.',
      ],
    ]],
    ['14. Fidel merchant enrolment and permission', [
      'By accepting this Agreement on behalf of a shop, you authorise The Loyalty Loop to submit the shop and its locations to Fidel API for card-linked rewards and to declare your consent to that enrolment. You confirm you have authority to give this permission for the business and each submitted location. We may share the business name, address, location and contact details, payment provider and merchant identifiers you supply with Fidel and the relevant card networks for matching eligible transactions.',
      'This permission covers matching purchases and refunds made by shoppers who separately consent to link their cards. It does not authorise collection of every customer\'s transactions, give you their full card details or replace shopper consent. Existing merchants must receive and accept this updated enrolment permission before we declare their consent to Fidel.',
      'Keep location and payment-provider details accurate and tell us if they change. Do not submit identifiers for another business or locations you do not control. Activation timing and card-network coverage are not guaranteed. You may request removal from card-linked participation through support; we will coordinate removal and explain any pending reconciliation.',
      'Only record genuine eligible purchases manually. Do not credit a payment already credited automatically. For a linked-card customer at an active card-linked shop, manual entries are for confirmed cash or unlinked-card payments, limited to three per customer per shop per day and at least 30 minutes apart when this feature is enabled. Honour valid rewards and assist with disputed purchases and refunds.',
    ]],
    ['About this document', [CREDIT]],
  ];

  const dpaSections = [
    ['1. Purpose and definitions', [
      `This Data Processing Addendum ("DPA") applies where a business ("Merchant", the "Controller") uses ${COMPANY} ("Provider", the "Processor") to process personal data of its loyalty programme members ("Customer Personal Data") on the Merchant's behalf. It forms part of the Merchant Agreement and reflects the requirements of Article 28 of the UK GDPR. If this DPA conflicts with the Merchant Agreement about the processing of Customer Personal Data, this DPA prevails.`,
      '"Data Protection Laws" means the UK GDPR, the Data Protection Act 2018 and the Privacy and Electronic Communications Regulations 2003, as amended or replaced, and, where applicable to the processing, the EU GDPR. "UK GDPR", "personal data", "processing", "controller", "processor", "data subject" and "personal data breach" have the meanings given in the UK GDPR. "Subprocessor" means a third party that we engage to process Customer Personal Data. "Restricted Transfer" means a transfer of personal data to a country or recipient outside the UK that is restricted by Chapter V of the UK GDPR.',
    ]],
    ['2. Duration and scope', [
      'This DPA remains in effect for as long as we process Customer Personal Data, even after the Merchant Agreement ends, and covers the provision of the Merchant Services described in the Merchant Agreement. Processing continues while the Merchant Agreement is in effect, and for a reasonable period afterwards as needed to return or delete Customer Personal Data under sections 4 and 10.',
    ]],
    ['3. Nature, purpose and details of processing', [
      "Where acting on a Merchant's instructions, we record member loyalty activity, eligible spend, reward progress, redemptions and refund adjustments; provide authorised staff access; and send requested communications subject to member preferences. Optional card-linked transaction matching helps reconcile the Merchant's programme. The Loyalty Loop separately acts as controller for its account administration, platform security and optional card-linking relationship with shoppers, as described in the Privacy Notice.",
      [
        'Data subjects: the Merchant\'s loyalty members, and the Merchant\'s staff users.',
        "Categories of personal data: names and contact information, loyalty identifiers, shop membership, purchase amount, currency and time, merchant and transaction references, refund and clearing status, progress, redemption records, and submitted messages or reviews. Provider card identifiers and limited card metadata support matching in the platform; this does not give merchants access to full card numbers or security codes.",
        'Special categories of data: none. The Merchant must not put sensitive categories of data (such as health, racial or ethnic origin, or government identification numbers) into the Merchant Services.',
        'Frequency: ongoing, as initiated by the Merchant\'s use of the Merchant Services.',
        'Duration and retention: for the term of the Merchant Agreement, then as set out in section 10.',
      ],
    ]],
    ['4. Processor obligations', [
      [
        "Process Customer Personal Data only on the Merchant's documented instructions, as set out in this DPA, the Merchant Agreement and the configuration and features the Merchant selects, unless the law requires otherwise (in which case we will tell the Merchant first, unless the law prohibits it). We will tell the Merchant if we believe an instruction breaches Data Protection Laws.",
        'Ensure that personnel authorised to process Customer Personal Data are bound by confidentiality obligations.',
        'Implement the technical and organisational security measures in Annex 1, which we may update provided the overall level of protection is not materially reduced.',
        'Notify the Merchant without undue delay after becoming aware of a personal data breach affecting Customer Personal Data, with the information we have available and the steps taken to mitigate it, and cooperate reasonably with the Merchant\'s investigation. Our notice is not an admission of fault.',
        'Taking into account the nature of the processing, assist the Merchant, where reasonably possible and technically feasible, in responding to data subject requests and in meeting its obligations for security, breach notification, data protection impact assessments and consultation with regulators. If we receive a data subject request about the Merchant\'s data, we will pass it to the Merchant and advise the person to contact the Merchant.',
        "At the Merchant's choice, delete or return Customer Personal Data at the end of the Merchant Services, as set out in section 10, except where retention is required by law.",
        'Make available information reasonably necessary to demonstrate compliance with this DPA, and allow for audits as described in section 7.',
        'Not use Customer Personal Data to train, fine-tune or improve any artificial-intelligence or machine-learning model, and prohibit our Subprocessors from doing so, unless the Merchant authorises it in writing.',
      ],
    ]],
    ['5. Merchant responsibilities', [
      [
        'The Merchant is the controller and is responsible for having a valid legal basis for its instructions, giving its members the notices required by Articles 12 to 14 of the UK GDPR, and obtaining any consents needed for its own use of the data (including marketing).',
        'The Merchant is responsible for how its staff use the Merchant Services, for keeping its account credentials and staff PINs secure, and for the accuracy of the data it enters.',
        'The Merchant must not put sensitive categories of data into the Merchant Services.',
      ],
    ]],
    ['6. Subprocessors', [
      `The Merchant gives general authorisation for ${COMPANY} to engage Subprocessors to provide the Merchant Services. The Subprocessors in use at the date of this DPA are listed in Annex 2. We will enter into a written contract with each Subprocessor that gives data protection obligations not less protective than those in this DPA, and we remain responsible for their performance of those obligations.`,
      'We will give the Merchant reasonable notice (including by email or in the dashboard) before adding or replacing a Subprocessor. If the Merchant objects on reasonable grounds relating to data protection within 15 days of the notice, we will work with the Merchant in good faith to resolve the objection. If we cannot, the Merchant may end the Merchant Agreement under section 5 of that agreement.',
    ]],
    ['7. Audits', [
      'On reasonable written request, we will provide the information reasonably necessary to demonstrate our compliance with this DPA and will allow and contribute to audits, including inspections, by the Merchant or an independent auditor it appoints, up to once a year (or more often where required by law or by a regulator). Audits are subject to reasonable notice, normal business hours, confidentiality and minimal disruption to our service, and the auditor must not be a competitor of ours.',
    ]],
    ['8. International transfers', [
      'We will only make a Restricted Transfer of Customer Personal Data where a lawful transfer mechanism is in place, such as an adequacy decision or approved data-bridge arrangement, the UK International Data Transfer Agreement, or the UK Addendum to the EU standard contractual clauses. To the extent the Merchant is a controller located in the UK, it authorises these transfers to the Subprocessors in Annex 2.',
    ]],
    ['9. Card-linking providers', [
      "Fidel API and payment networks participate in enrolment and transaction matching. Their role for each processing activity must follow the applicable provider agreement; this DPA does not label all Fidel or network processing as processing solely on the Merchant's instructions. Where a provider acts as our Subprocessor for Customer Personal Data, section 6 applies. Independently controlled processing is subject to that provider's own notice and lawful basis. Merchant instructions cannot override a shopper's card-linking withdrawal.",
    ]],
    ['10. Return and deletion', [
      "When the Merchant Services end, we will stop processing Customer Personal Data except to store it and return, delete or anonymise it. On written request made within 30 days after the end date, we will at the Merchant's choice return a copy of Customer Personal Data by a secure method and then delete it, or delete it. If no instruction is given in that period, we will delete or anonymise the data within a reasonable time afterwards. We may keep data where the law requires it, only for as long and for the purpose the law requires, and keep it confidential and secure.",
      "Assist with correction and deletion requests, including identifying disputed transactions. Account-level card removal and deletion are handled under the Privacy Notice; ending one shop membership is not a request to delete the shopper's entire platform account.",
    ]],
    ['11. Liability and general', [
      "Each party's liability under this DPA is subject to the limitations and exclusions of liability in the Merchant Agreement, except that nothing limits liability that cannot be limited by law or rights data subjects have under Data Protection Laws. We may vary this DPA on written notice only as necessary to stay compliant with Data Protection Laws, provided the variation does not materially reduce the protection of Customer Personal Data. This DPA is governed by the laws of " + JURISDICTION + '.',
      `Data protection questions about this DPA can be sent to ${CONTACT_EMAIL}.`,
    ]],
    ['Annex 1: Security measures', [
      [
        'Information security responsibility: named responsibility for the development, implementation and maintenance of our security programme, with periodic review of risks.',
        'Data segregation and access control: logical separation of data between merchants, access controls enforced at the database level, role-based permissions (including for staff scanning and redemption actions), least-privilege access and unique credentials.',
        'Encryption and credentials: encryption of data in transit over public networks and at rest on our hosting providers, and secure hashed storage of credentials such as staff PINs.',
        'Logging and monitoring: logging of user access and system activity, error monitoring and alerting.',
        'Operational controls: secure configuration and maintenance of systems, tracked change management, and vulnerability and patch management, including dependency updates.',
        'Incident response: procedures to investigate, contain and notify in line with section 4 of this DPA.',
        'Physical and environmental security: provided by our hosting and cloud providers in secured data centres.',
        'Continuity: backup and recovery arrangements designed to restore the service after foreseeable incidents.',
      ],
    ]],
    ['Annex 2: Subprocessors', [
      [
        'Supabase: cloud database, authentication and file storage.',
        'Vercel: web hosting and delivery.',
        'Resend: transactional email delivery.',
        'Fidel API: optional card enrolment and transaction matching, to the extent it acts as our Subprocessor (see section 9).',
        'Expo and the mobile platform notification services (Apple and Google): push notification delivery.',
        'Google: maps and location-based features.',
        'Sentry: technical error monitoring, configured not to receive personal data such as email addresses.',
      ],
      'Optional AI-assisted analytics or research features are provided only where the Merchant actively enables them. We will update this list before changes take effect, as described in section 6.',
    ]],
    ['About this document', [CREDIT]],
  ];

  return { merchantSections, dpaSections };
};
