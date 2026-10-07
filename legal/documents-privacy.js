// Privacy Notice and Cookie Policy.
// Structure and wording adapted from General Legal's "Privacy Policy (GDPR
// Enhanced)" and "Cookie Notice" templates (CC0 1.0,
// https://github.com/General-Legal/legal-templates), converted to UK GDPR / Data
// Protection Act 2018 / PECR for a UK business. U.S. state-law sections,
// advertising and sale/sharing provisions, and EU/UK representative sections
// were removed because they do not apply. The Loyalty Loop's own card-linking,
// reward and retention statements are carried over.

module.exports = function (ctx) {
  const { COMPANY, CONTACT_EMAIL, CREDIT } = ctx;

  const privacySections = [
    ['1. Who we are and what this notice covers', [
      `${COMPANY} ("we", "us", "our") runs a loyalty platform that lets shoppers collect stamps and rewards at local shops, and lets shops run those programmes. This Privacy Notice explains how we handle personal data collected through our website, our shopper and business mobile applications, and related communications (together, the "Service"). Please also read our Cookie Policy, which forms part of this notice.`,
      `We are the data controller for the personal data described here, except where we process data on behalf of a participating shop that is the controller for its own members' loyalty data, as explained in section 6. You can contact us about privacy at ${CONTACT_EMAIL}.`,
      'In this notice, "personal data" means information about an identifiable person. We have not appointed a Data Protection Officer, and the contact address above handles all privacy requests.',
    ]],
    ['2. Personal data we collect', [
      'Information you give us:',
      [
        'Account and contact data: your name, email address, optional phone number and postcode, and sign-in details. If you sign in with Apple or Google, we receive the basic profile details you allow them to share.',
        'Loyalty data: the shops you join, loyalty progress, recorded spend, rewards, redemptions, visits, and referrals.',
        'Content and communications: reviews, replies, messages to shops or to us, support requests, and notification and marketing preferences.',
        'Business data (for shop owners and staff): business and location details, role and staff permissions, payment-provider details and any merchant identifiers supplied for card-linking enrolment.',
      ],
      'Information we collect automatically:',
      [
        'Device and technical data: device and browser type, operating system, IP address, language, and error and crash information needed to run and secure the Service.',
        'Online activity data: pages you view, when and how you use features, and navigation paths. Optional usage analytics are collected only if you choose "Accept all" (see our Cookie Policy).',
        'Location data: your device location, only when you give permission, for nearby-shop features.',
        'Notification tokens: identifiers that let us deliver push notifications to your device, if you allow them.',
      ],
      'Information from other sources:',
      [
        'Participating shops, which record purchases or loyalty actions for you at the point of sale.',
        'Fidel API, when you choose card linking. Fidel collects card details directly through its secure enrolment form, so we never receive your full card number or card security code. We store a provider card identifier, card scheme, last four digits, link status and linking and unlinking timestamps. For matched transactions, Fidel sends purchase or refund identifiers, linked-card and merchant or location identifiers, amount, currency, transaction time and authorisation, clearing or refund status. We keep transaction and webhook records, including processing outcomes, to calculate rewards, reconcile refunds, investigate failures and prevent duplicate credit. This is purchase-level data, not a list of individual items or access to your bank balance.',
        'Our service providers, such as sign-in providers and our hosting and email providers, about the operation of your account.',
      ],
      'We ask that you do not give us sensitive information, such as health details, racial or ethnic origin, political opinions, religious beliefs or government identification numbers, through the Service. We do not intentionally collect these categories.',
    ]],
    ['3. How we use your personal data and our legal bases', [
      'Under UK data protection law we must have a legal basis for each use of your data. Ours are:',
      [
        'To provide the Service you ask for (create and run your account, record eligible purchases, calculate progress and rewards, apply refunds, manage redemption, answer support requests, and send service messages). Legal basis: performance of our contract with you.',
        'To keep the Service secure, investigate misuse, prevent duplicate rewards and resolve disputes. Legal basis: our legitimate interests in running a safe and fair service, balanced against your rights. Where relevant, also compliance with legal obligations.',
        'To monitor errors and reliability (for example, by receiving technical error reports). Legal basis: legitimate interests in keeping the Service working and secure. These reports are configured not to include personal data such as your email address.',
        'To understand how the Service is used and improve it through optional usage analytics. Legal basis: your consent, given through our cookie banner. You can decline, and the Service works fully without it.',
        'To send you marketing or promotional messages, where you have opted in. Legal basis: your consent, which you can withdraw at any time. We send service messages (such as account and security notices) without marketing consent.',
        'To process your card and transaction data for optional card-linked rewards. Legal basis: your consent, given separately in the Fidel enrolment form. This is separate from cookies, analytics, marketing and notification permissions, and you can withdraw it by removing the linked card or contacting us. Withdrawal does not affect processing already carried out lawfully.',
        'To comply with the law and to establish, exercise or defend legal claims. Legal basis: legal obligation and legitimate interests.',
        'To create aggregated or anonymised statistics that no longer identify you, which we may use to analyse and improve the Service. Legal basis: legitimate interests.',
      ],
      'If we want to use your data for a new purpose that is not compatible with the original one, we will ask for your consent or tell you first, as the law requires.',
    ]],
    ['4. Automated reward calculations', [
      'Reward calculations and refund adjustments are automated using the matched amount and the shop threshold. A refund can reduce progress below zero and temporarily block redemption at that shop. This does not produce legal or similarly significant effects on you, and we do not use your data for profiling or advertising. You can contact us to challenge an incorrect match or adjustment and ask for a human review.',
    ]],
    ['5. Cookies and similar technologies', [
      'We use essential browser storage to keep you signed in and remember your privacy choice, and optional analytics only if you accept them. Details, including who provides each technology and how to change your choice, are in our Cookie Policy.',
    ]],
    ['6. Who we share your data with', [
      [
        'Shops you join. A shop\'s authorised owners and staff can see the member information and loyalty activity needed to run that shop\'s programme. This does not give them your full payment card details or your activity at unrelated shops. Each shop is responsible for its own lawful use of data it controls; where we process member data on a shop\'s behalf, we do so under our Data Processing Addendum.',
        'Fidel API and the card networks (Visa, Mastercard and American Express), for optional card enrolment and transaction matching. We share the identifiers and programme or merchant information needed for that service and receive matched transaction events. Fidel and the networks may have their own responsibilities for data they handle; see the notices shown at enrolment and Fidel\'s privacy notice at https://www.fidelapi.com/legal/privacy.',
        'Service providers that help us run the Service: our cloud database, authentication and storage provider (Supabase), our hosting provider (Vercel), our email provider (Resend), our mobile push notification providers, Google (for maps and Google sign-in), Apple (for Apple sign-in), and our error-monitoring provider (Sentry). We give them only the data they need and require them to protect it.',
        'Professional advisers such as lawyers, accountants and insurers, where needed.',
        'Authorities and others, where we believe in good faith that disclosure is required by law, or necessary to protect users, the Service or our rights.',
        'A buyer or successor, if we are involved in a merger, acquisition, financing or sale of all or part of our business, with appropriate safeguards.',
      ],
      'We do not sell your personal data and we do not share it for advertising. Card linking does not give a shop permission to send you marketing without your separate permission.',
    ]],
    ['7. How long we keep your data', [
      'We keep account and loyalty data while needed to provide your account and programme. Transaction, refund and processing records are used to maintain accurate balances, investigate duplicate or missing events and resolve disputes. We keep data for as long as the purposes above remain necessary and any legal duties require, considering its amount, nature and sensitivity and the risk of harm from misuse. When we no longer need it, we delete or anonymise it or, if that is not yet possible (for example because it sits in a backup), we keep it securely and isolate it from further use until it can be deleted. Anonymised data may be used without further notice.',
      'Where card linking is enabled, removing a card stops future earning for that link and starts its removal from Fidel. Provider removal can take time; contact us if it is not completed. You can request account deletion through your profile or by contacting us. The deletion process removes linked cards at Fidel before completing deletion of the account and its linked-card and transaction records; if provider removal fails, the request stays open until it is retried or resolved with support.',
      'We do not promise immediate deletion from all backups or from independently controlled shop, Fidel or payment-network records. Records we keep to meet a specific legal obligation are limited to that purpose. Contact us for details of retention or the progress of a deletion request.',
    ]],
    ['8. International transfers', [
      'Some of our service providers handle data outside the United Kingdom, including in the European Economic Area and the United States. Where personal data is transferred outside the UK, we rely on one of the following: an adequacy decision by the UK Government for the destination; appropriate safeguards, such as the UK International Data Transfer Agreement or the UK Addendum to the EU standard contractual clauses, or an approved data-bridge framework; or, in limited circumstances, an exception such as your explicit consent. Contact us if you would like more information about the safeguards for a particular transfer.',
    ]],
    ['9. Security', [
      'We use technical, organisational and physical safeguards designed to protect your personal data, including access controls enforced at the database level, role-based permissions and encryption of stored credentials such as staff PINs. No internet service can be completely secure, so we cannot guarantee absolute security.',
    ]],
    ['10. Your rights and choices', [
      'Under UK data protection law you have the right to:',
      [
        'Access the personal data we hold about you and receive information about how we use it.',
        'Correct inaccurate or incomplete data.',
        'Erase your data where there is no good reason for us to keep it.',
        'Restrict our processing, for example while we check its accuracy.',
        'Receive a machine-readable copy of data you gave us, or have it sent to another provider (portability).',
        'Object to processing based on our legitimate interests, and to direct marketing.',
        'Withdraw your consent at any time where we rely on it, without affecting earlier processing.',
        'Ask for human review of an automated reward calculation or adjustment.',
      ],
      `To use these rights, contact ${CONTACT_EMAIL}. We may ask for information to confirm your identity, and we will explain our reasons if we cannot fully meet a request. You can also manage some choices yourself: update your account details in your profile, opt out of marketing messages by following the unsubscribe link or changing your preferences, switch off notifications or location access in your device settings, remove a linked card, or delete your account. Some information is needed for the Service to work; if you do not provide it, we may not be able to provide certain features.`,
      'You may complain to the UK Information Commissioner\'s Office (ICO), Wycliffe House, Water Lane, Wilmslow, Cheshire SK9 5AF, telephone 0303 123 1113, website https://ico.org.uk/. You do not need to contact us first, although we would welcome the chance to put things right. If you live in the European Economic Area, you may also complain to your local data protection authority.',
    ]],
    ['11. Children', [
      'The Service is not directed at children under 16, and we do not knowingly collect personal data from them. If you believe a child has given us personal data, please contact us and we will take appropriate steps to delete it.',
    ]],
    ['12. Other sites and services', [
      'The Service may link to websites and services run by others, including participating shops. We do not control them and are not responsible for their privacy practices. We encourage you to read their privacy notices.',
    ]],
    ['13. Changes to this notice', [
      'We may update this Privacy Notice from time to time. If we make material changes, we will update the effective date and notify you through the Service or by email before they take effect.',
    ]],
    ['14. Contact us', [
      `For any privacy question or to exercise your rights, contact us at ${CONTACT_EMAIL}.`,
    ]],
    ['About this document', [CREDIT]],
  ];

  const cookieSections = [
    ['1. What this policy covers', [
      `This Cookie Policy explains how ${COMPANY} uses cookies and similar technologies on our website and mobile applications (the "Service"). It should be read with our Privacy Notice, which explains how we use personal data more generally.`,
      'Cookies are small files placed on your device when you visit a website. Similar technologies include browser local storage, which stores data in your browser for a similar purpose, and push-notification tokens in mobile apps. We refer to all of these as "cookies" in this policy. Some last only until you close your browser (session), and others stay until you delete them or they expire (persistent).',
    ]],
    ['2. The categories we use', [
      [
        'Essential. Needed for the Service to work, so they do not need your consent. Our website uses browser storage to keep you signed in (provided by our authentication provider, Supabase) and to remember your cookie choice. Mobile apps store a sign-in session and, if you allow notifications, a push notification token. Essential storage cannot be switched off in our banner, but you can block it in your browser, which may stop sign-in from working.',
        'Error monitoring. We use Sentry to receive technical error reports so we can fix faults and keep the Service secure. It is configured not to collect personal data such as your email address, and it does not use advertising cookies.',
        'Analytics (optional). If you choose "Accept all" and are signed in, we record basic usage events in our own database, such as the event name, the page or screen, and your account identifier, so that we can see which features are used and improve the Service. These records are not anonymous because they are linked to your account. We do not use third-party analytics services, advertising or cross-site tracking.',
        'Maps and sign-in (third-party). Features such as maps (Google) and sign-in with Google or Apple connect to those providers, who may set their own cookies or collect connection details under their own notices.',
      ],
      'We do not use advertising or social-media tracking cookies.',
    ]],
    ['3. Other technologies', [
      [
        'Browser web storage (local storage) holds your sign-in session, your cookie choice and some preferences. You can clear it in your browser settings.',
        'Mobile SDKs and device identifiers. Our apps use software libraries from our providers, for example for push notifications and sign-in, which may use device identifiers needed for those features to work.',
        'Card linking. Optional card linking opens Fidel\'s hosted enrolment form, which processes connection and device information under its own notice. The form has a separate card-linking consent; our cookie banner cannot grant it on your behalf, and choosing "Essential only" does not unlink an already linked card.',
      ],
    ]],
    ['4. Your choices', [
      [
        'Cookie banner. The banner offers "Accept all" or "Essential only". Your choice is saved in your browser. Choosing "Essential only" switches off optional analytics. To change your choice, clear this site\'s stored data in your browser and choose again on your next visit; this may also sign you out. Different devices and browsers keep separate choices.',
        'Browser settings. Most browsers let you block or delete cookies. Please note that if you block essential cookies, parts of the Service may not work. For more information about managing cookies, see https://www.aboutcookies.org.',
        'Do Not Track. We do not currently respond to "Do Not Track" browser signals, but optional analytics only run if you accept them.',
        'Notifications and marketing. These are separate account controls and are not changed by the cookie banner. When card linking is available, use Linked cards to remove a card; clearing browser storage alone does not withdraw card-monitoring consent.',
      ],
    ]],
    ['5. Changes to this policy', [
      'Information about the technologies we use may change from time to time. When it does, we will update this policy and its effective date, so please check back regularly.',
    ]],
    ['6. Contact us', [
      `Questions about our use of cookies can be sent to ${CONTACT_EMAIL}.`,
    ]],
    ['About this document', [CREDIT]],
  ];

  return { privacySections, cookieSections };
};
