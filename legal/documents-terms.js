// Terms of Service and Acceptable Use Policy.
// Structure and wording adapted from General Legal's "Terms of Use" template
// (CC0 1.0, https://github.com/General-Legal/legal-templates), converted to the
// law of England and Wales for consumers and businesses, with The Loyalty Loop's
// own loyalty, spend-reward and card-linking terms carried over unchanged.

module.exports = function (ctx) {
  const { COMPANY, CONTACT_EMAIL, JURISDICTION, CREDIT } = ctx;

  const termsSections = [
    ['1. About these Terms', [
      `These Terms of Service ("Terms") govern your access to and use of ${COMPANY} ("we", "us", "our"), including our website, our mobile applications and the loyalty services we provide (together, the "Service"). They apply to everyone who creates an account or otherwise uses the Service: customers collecting stamps or rewards ("shoppers"), business owners running a loyalty programme, staff working at a participating shop, and platform administrators.`,
      'By creating an account, clicking "I agree" (or a similar button) or using the Service, you agree to these Terms. If you do not agree, please do not use the Service. You must be at least 16 years old to use the Service. If you use the Service on behalf of a business, you confirm that you have authority to bind that business.',
      'Business owners are additionally bound by our Merchant Agreement and Data Processing Addendum, which form part of these Terms where they apply. Our Privacy Notice, Cookie Policy and Acceptable Use Policy also form part of these Terms. If there is a conflict between these Terms and the Privacy Notice about how personal data is handled, the Privacy Notice prevails.',
    ]],
    ['2. What the Service does', [
      'The Loyalty Loop helps local shops run loyalty programmes. We are introducing cumulative spend rewards: eligible purchases build progress towards the pound amount shown by each shop, with excess spend carried towards the next reward. Existing stamp and points programmes continue until their shop moves to spend rewards. Your shop page shows the rules that currently apply.',
      'Where card-linked earning is available, you can choose to link an eligible card through Fidel API and earn from matched GBP purchases at participating shops. This feature is being rolled out and is not available at every shop. Staff-recorded purchases are available where the shop supports them. Linking a card does not guarantee that every payment will be matched.',
    ]],
    ['3. Accounts', [
      [
        'Creating an account. Some features require an account. You must give accurate and complete information and keep it up to date. You can delete your account at any time from your profile settings or by contacting us.',
        'Account security. You are responsible for keeping your login details and any staff PIN confidential and for activity under your account. Tell us promptly if you think someone else has accessed your account. We are not responsible for losses caused by your failure to keep your details secure, except where the law does not allow us to exclude that responsibility.',
        'Business accounts. Business owner accounts go live on completing onboarding, without a manual approval step. A separate "verified" badge is available on request and is reviewed by our team, but is not required for a shop to operate.',
      ],
    ]],
    ['4. Using the Service', [
      [
        'Licence. Subject to these Terms, we grant you a limited, non-exclusive, non-transferable, revocable licence to use the Service for its intended purpose.',
        'Restrictions. You must not: (i) sell, rent, lease, sub-license or commercially exploit the Service or its content; (ii) modify, create derivative works from, decompile or reverse-engineer any part of the Service, except where the law allows it; (iii) use the Service to build a competing product; or (iv) copy, republish or transmit any part of the Service except as these Terms allow.',
        'Changes to the Service. We may improve, change, suspend or discontinue features. Where a change materially reduces something you rely on, we will give reasonable notice where we can. This does not affect any rights you have under consumer law.',
        'Ownership. The Service, its design, branding, software and content are owned by us or our licensors and protected by intellectual property laws. These Terms do not transfer ownership to you. All rights not expressly granted are reserved.',
        'Feedback. If you send us feedback or suggestions, you allow us to use them freely to improve the Service without paying you or crediting you. Please do not send anything you regard as confidential.',
      ],
    ]],
    ['5. Stamps, points and rewards', [
      'Progress and rewards have no cash value, cannot be transferred between accounts and cannot be exchanged for cash. Each shop displays its reward and threshold. Reward expiry and eligibility conditions are shown in the Service. Changes do not affect rights you have under consumer law.',
      'For spend-based programmes, progress may be credited when a purchase is authorised and corrected when final payment or refund information arrives. A full or partial refund reduces progress by the refunded amount. This can make progress negative, including after a reward has been used. Redemption at that shop is paused while the balance is negative; eligible new spend restores progress and clears the pause when the balance reaches zero. Contact support if an adjustment appears wrong.',
      'Card-linked earning depends on card eligibility, an active participating location and successful payment-network matching. Some payment providers use shared merchant identifiers, so automatic earning may be unavailable. Do not submit the same purchase for both automatic and manual credit.',
    ]],
    ['6. Optional card linking', [
      'When available, card linking is optional and requires the separate consent presented in the Fidel enrolment form. Accepting these Terms, joining a shop or accepting cookies does not link a card or authorise transaction monitoring. Only link a card you are authorised to use. The supported programme is for eligible Visa, Mastercard and American Express cards, subject to the enrolment checks.',
      'Use the number on your physical card, rather than a virtual wallet card number. Up to five active cards may be linked to one account; a card cannot be linked to two shopper accounts at once. Fidel handles card entry. We do not receive your full card number or security code, and linking does not authorise us to charge your card.',
      'Where the feature is enabled, remove a card through Your account > Linked cards to stop future earning from it. We request removal from Fidel; provider processing or already-in-flight events may take time. Unlinking does not erase previous loyalty activity or cancel valid refund adjustments. Contact support if removal is unavailable or fails. Account deletion is a separate request, described in the Privacy Notice.',
    ]],
    ['7. Acceptable use', [
      'You agree not to misuse the Service. This includes attempting to claim stamps or rewards you have not genuinely earned, scanning or entering codes that do not belong to you, abusing the referral programme, or interfering with the proper working of the Service. Our full list of prohibited conduct is in our Acceptable Use Policy, which forms part of these Terms.',
    ]],
    ['8. Reviews and content you submit', [
      'If you leave a review, reply or other content through the Service, you must have genuinely visited or interacted with the relevant shop where required, and your content must be honest, lawful, and not defamatory, harassing or infringing of anyone else\'s rights. We may remove content that breaches these Terms and may suspend accounts that repeatedly do so.',
      'You keep ownership of content you submit, but you give us a worldwide, non-exclusive, royalty-free licence to host, display and distribute it as part of operating the Service (for example, showing your review to other customers of that shop). This licence ends when the content is deleted, except for copies we must keep by law or that other users have already shared in line with the Service.',
    ]],
    ['9. Privacy and cookies', [
      'Your use of the Service is also governed by our Privacy Notice, which explains what personal data we collect, how we use it and the circumstances in which we share it. We may use cookies and similar technologies as described in our Cookie Policy. Optional analytics run only if you choose "Accept all" in our cookie banner.',
    ]],
    ['10. Third-party services and other users', [
      [
        'Third-party services. The Service links to or works with third parties such as sign-in providers, maps, card-linking and payment-network providers. We do not control them and are not responsible for their services. Their own terms and privacy notices apply to your use of them.',
        'Other users and shops. Shops are independent businesses. We are not responsible for the acts or omissions of participating shops, including their decisions about rewards, opening hours, or the quality of goods and services they provide, except where the law says we are. Your dealings with other users are between you and them.',
      ],
    ]],
    ['11. Our responsibility to you', [
      'We provide the Service with reasonable care and skill. The Service is provided "as is" and "as available", and we do not promise that it will be uninterrupted, error-free or secure at all times, although we work to keep it reliable.',
      'Nothing in these Terms limits or excludes our liability for death or personal injury caused by our negligence, for fraud or fraudulent misrepresentation, or for anything else that cannot be limited or excluded by law. If you are a consumer, your statutory rights are not affected.',
      'Subject to the above, and to the extent permitted by law, we are not liable for loss of profit, loss of data, or indirect or consequential loss that was not a foreseeable result of our breach. If you use the Service on behalf of a business, our total liability to you for all claims arising from the Service in any 12-month period is limited to the greater of £100 and the fees you paid us in that period. If you are a consumer, we are responsible for foreseeable loss and damage caused by our failure to use reasonable care and skill.',
    ]],
    ['12. Suspension and termination', [
      'You may stop using the Service and request deletion of your account at any time from your profile settings. We may suspend or terminate your account if you materially breach these Terms, our Acceptable Use Policy or applicable law, or if we reasonably believe your account poses a risk to the Service or other users. Where reasonable, we will tell you why and give you a chance to respond. Sections that by their nature should continue (including ownership, liability and governing law) survive termination.',
    ]],
    ['13. Changes to these Terms', [
      'We may update these Terms to reflect changes to the Service or for legal or regulatory reasons. If we make a material change, we will notify you in the Service or by email before it takes effect. If you do not agree to a change, you can stop using the Service and delete your account. Continued use after the change takes effect means you accept the updated Terms.',
    ]],
    ['14. Complaints and disputes', [
      `If you have a complaint, please contact us at ${CONTACT_EMAIL} first so we can try to resolve it informally. We aim to respond promptly. You are free to use any alternative dispute resolution service available to you, and these Terms do not require you to use arbitration or give up the right to take part in court proceedings.`,
    ]],
    ['15. General', [
      [
        'Electronic communications. You agree that we may contact you electronically (by email or notices in the Service) and that these satisfy any requirement for written notice.',
        'Accessibility. We aim to make the Service accessible to everyone, including people with disabilities, and work towards the Web Content Accessibility Guidelines (WCAG) 2.1 level AA. If you have difficulty using the Service, contact us at ' + CONTACT_EMAIL + ' and we will make reasonable efforts to help.',
        'Entire agreement. These Terms and the documents they refer to are the whole agreement between you and us about the Service. If a provision is found invalid or unenforceable, the rest continues in effect. If we do not enforce a right straight away, we do not lose it later.',
        'Transfer. You may not transfer your rights under these Terms without our written consent. We may transfer ours to a company that takes over the Service, if that does not reduce your rights.',
        'Third-party rights. Apart from us and you, no one has a right to enforce these Terms under the Contracts (Rights of Third Parties) Act 1999.',
        `Governing law. These Terms are governed by the laws of ${JURISDICTION}. The courts of ${JURISDICTION} have non-exclusive jurisdiction. If you are a consumer living in Scotland or Northern Ireland, you may also bring proceedings in the courts there, and you keep the protection of the mandatory consumer laws of the country where you live.`,
      ],
    ]],
    ['16. Contact us', [
      `Questions about these Terms can be sent to ${CONTACT_EMAIL}.`,
    ]],
    ['About this document', [CREDIT]],
  ];

  const aupSections = [
    ['1. Purpose', [
      `This Acceptable Use Policy explains what you must not do when using ${COMPANY}. It applies to every account holder, including customers, business owners, staff and administrators, and forms part of our Terms of Service.`,
    ]],
    ['2. Prohibited activities', [
      'You must not:',
      [
        "Attempt to claim, award or redeem stamps, points or rewards you are not genuinely entitled to, including by sharing, guessing or brute-forcing another customer's loyalty code or QR code.",
        "Create multiple accounts to abuse sign-up rewards, the referral programme or a shop's loyalty programme.",
        'Use automated means (bots, scrapers or scripts) to access the Service, extract data, or interact with shops or other users, except where we have explicitly permitted this.',
        'Attempt to circumvent rate limits, security controls or access restrictions built into the Service.',
        "Access or attempt to access another user's account, or any part of the Service you are not authorised to use, including as a staff member acting outside your granted permissions.",
        'Submit reviews, replies, announcements or messages that are false, defamatory, harassing, hateful, obscene or otherwise unlawful.',
        "Upload malicious code, or content that infringes someone else's intellectual property or privacy rights.",
        'Use the Service to send unsolicited marketing to people who have not consented to receive it.',
        'Reverse-engineer, decompile or attempt to extract the source code of the Service, except where the law permits it.',
        "Use the Service in any way that could disable, overburden, damage or impair it, or interfere with anyone else's use of it.",
      ],
    ]],
    ['3. Business owner and staff responsibilities', [
      "Business owners are responsible for the actions of staff accounts they create, and must revoke a staff member's access promptly once that person is no longer authorised to act for the business. Staff members must only scan, redeem or respond to reviews within the permissions granted to them, and must not share their password or PIN with anyone else.",
    ]],
    ['4. Card-linked rewards and transaction data', [
      "Do not link a card without authority, attempt to claim another shopper's card, falsify merchant enrolment permission or submit misleading payment or refund records. Do not seek duplicate credit through both card-linked and manual entries, bypass manual-entry limits, or exploit refund timing to redeem rewards you are not entitled to.",
      'Use member and transaction data only for authorised loyalty operations. Do not extract card-linked data for unrelated profiling, sell it, or request full card numbers or security codes through messages, support tickets or staff forms. Report suspected matching errors to support.',
    ]],
    ['5. Reporting a problem', [
      `If you believe someone is misusing the Service, or you have found a security issue, please contact us at ${CONTACT_EMAIL} as soon as possible so we can investigate.`,
    ]],
    ['6. Consequences of breach', [
      'We may remove content, suspend or restrict features, or terminate accounts that breach this policy, with or without notice depending on the severity of the breach. We may also take legal action or report unlawful activity to the relevant authorities where appropriate.',
    ]],
    ['7. Changes to this policy', [
      'We may update this policy from time to time. If we make a material change we will tell you in the Service or by email. Continued use of the Service after an update takes effect means you accept the revised policy.',
    ]],
  ];

  return { termsSections, aupSections };
};
