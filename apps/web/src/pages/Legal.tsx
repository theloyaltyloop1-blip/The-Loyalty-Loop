import { Link } from 'react-router-dom'

export type LegalDocumentType = 'terms' | 'privacy' | 'cookies' | 'merchant-agreement' | 'data-processing' | 'acceptable-use'

type Section = { heading: string; body: string }
type LegalDocument = { type: LegalDocumentType; title: string; description: string; audience: string; sections: Section[] }

export const LEGAL_DOCUMENTS: LegalDocument[] = [
  { type: 'terms', title: 'Terms of Service', description: 'Rules for customers and all account holders using The Loyalty Loop.', audience: 'All users', sections: [
    { heading: 'Using the service', body: 'The Loyalty Loop helps customers collect and redeem loyalty rewards offered by participating businesses. Each business remains responsible for its own offers, availability, goods, services and fulfilment.' },
    { heading: 'Your account', body: 'Keep your login details secure and provide accurate account information. You are responsible for activity carried out through your account unless you tell us promptly about unauthorised use.' },
    { heading: 'Rewards', body: 'Rewards are created and honoured by the relevant business. They have no cash value unless the business expressly states otherwise, may be subject to business-specific terms, and can be withdrawn where required by law or where fraud is suspected.' },
    { heading: 'Suspension and changes', body: 'We may suspend access where necessary to protect the service, users or data. We may update these terms and will publish the updated version here.' },
  ] },
  { type: 'privacy', title: 'Privacy Notice', description: 'How we collect, use and protect personal data.', audience: 'All users', sections: [
    { heading: 'Information we process', body: 'We process account details, profile information, loyalty activity, earned rewards, notifications, reviews, support requests and the preferences you choose in the app.' },
    { heading: 'Why we use it', body: 'We use this information to operate loyalty cards, award and redeem rewards, provide customer and business support, send opted-in service communications, protect against misuse, and improve the service.' },
    { heading: 'Who receives it', body: 'A participating business can see the information needed to run its loyalty programme, such as membership and activity relevant to that business. We use service providers to host the app, store data and send emails. We do not sell personal data.' },
    { heading: 'Your rights and choices', body: 'You can manage notification preferences in the app and request deletion of your account from your Profile page. You may also contact us with a privacy request. We retain information only for as long as needed for the purposes described here and legal obligations.' },
  ] },
  { type: 'cookies', title: 'Cookie Policy', description: 'How browser storage and similar technologies are used.', audience: 'All users', sections: [
    { heading: 'Essential storage', body: 'We use essential browser storage to keep you signed in, remember basic choices and protect the service. These are necessary for the app to work.' },
    { heading: 'Optional preferences', body: 'Where optional preference storage is used, you can choose whether to allow it through the cookie choices shown in the app. You can also clear browser storage from your browser settings.' },
    { heading: 'Third parties', body: 'Third-party services used to host the app, authenticate users and deliver emails may set or process information in line with their own policies. We do not use advertising cookies in the app.' },
  ] },
  { type: 'merchant-agreement', title: 'Merchant Agreement', description: 'Terms for businesses operating a loyalty programme through The Loyalty Loop.', audience: 'Business owners', sections: [
    { heading: 'Your business programme', body: 'You set your shop details, reward rules and offers. You are responsible for ensuring they are accurate, lawful, clearly described and honoured. You must not use the platform for unlawful, discriminatory, misleading or unsafe offers.' },
    { heading: 'Customer data', body: 'You may only use customer information accessed through the platform to run your loyalty programme, provide customer support and meet legal obligations. You must not export, sell, disclose or use it for unrelated marketing without a lawful basis and required consent.' },
    { heading: 'Your content and permissions', body: 'You confirm that you have the rights to use the logos, photos, copy and other material you upload. You must keep access credentials secure and ensure staff use only the permissions needed for their role.' },
    { heading: 'Account action', body: 'We may suspend or remove a shop where there is suspected misuse, a security risk, breach of these terms, or a legal requirement. You may deactivate or delete your shop through Shop settings, subject to any retention required by law.' },
  ] },
  { type: 'data-processing', title: 'Data Processing Addendum', description: 'Data-processing terms for participating businesses.', audience: 'Business owners', sections: [
    { heading: 'Roles', body: 'For customer personal data a business uses to run its own loyalty programme, the business is normally the controller and The Loyalty Loop acts as processor on the business’s documented instructions. The Loyalty Loop acts as an independent controller for platform account, security and service-operation data where applicable.' },
    { heading: 'Processing instructions', body: 'We process personal data only to provide, secure, maintain and support the service, comply with applicable law, and follow documented instructions that are consistent with the agreement and the service.' },
    { heading: 'Security and confidentiality', body: 'We apply reasonable technical and organisational safeguards and limit access to authorised personnel and providers who are bound by confidentiality and data-protection obligations.' },
    { heading: 'Assistance and deletion', body: 'We will provide reasonable assistance with data-subject requests and security incidents relevant to the service. At the end of the service, data is deleted or returned unless retention is required by law or necessary for legitimate security and record-keeping purposes.' },
  ] },
  { type: 'acceptable-use', title: 'Acceptable Use Policy', description: 'Prohibited uses of The Loyalty Loop.', audience: 'All users', sections: [
    { heading: 'Do not misuse the service', body: 'Do not attempt to access accounts, data or shops you do not own or manage; bypass permissions; introduce malware; disrupt the service; scrape personal data; or use the platform to defraud customers or businesses.' },
    { heading: 'Respect people and law', body: 'Do not post or send unlawful, abusive, discriminatory, infringing, deceptive or harmful content. Do not use customer details for spam or unsolicited marketing.' },
    { heading: 'Reporting concerns', body: 'Businesses can use Help & support in their owner portal to report a concern. We may investigate and take action, including restricting access, where this policy is breached.' },
  ] },
]

export function LegalFooter({ className = '' }: { className?: string }) {
  return <nav aria-label="Legal documents" className={className}>{LEGAL_DOCUMENTS.map((doc) => <Link key={doc.type} to={`/legal/${doc.type}`} className="hover:underline">{doc.title}</Link>)}</nav>
}

export function LegalHub() {
  return <main className="min-h-screen bg-[#F7ECDC] p-8 text-[#1a1a1a]"><div className="mx-auto max-w-4xl"><Link to="/" className="font-bold text-[#C9622E]">← The Loyalty Loop</Link><p className="mt-10 text-xs font-bold uppercase tracking-wide text-black/40">Legal centre</p><h1 className="mt-2 font-display text-4xl font-extrabold">Legal documents</h1><p className="mt-3 max-w-2xl text-[#1a1a1a]/65">Read the documents that govern use of The Loyalty Loop. These documents are templates and should be reviewed by a qualified legal adviser before relying on them.</p><div className="mt-8 grid gap-4 md:grid-cols-2">{LEGAL_DOCUMENTS.map((doc) => <Link key={doc.type} to={`/legal/${doc.type}`} className="rounded-2xl bg-[#FBF6EC] p-6 shadow-sm transition hover:-translate-y-0.5"><p className="text-xs font-bold uppercase tracking-wide text-[#C9622E]">{doc.audience}</p><h2 className="mt-2 font-display text-xl font-bold">{doc.title}</h2><p className="mt-2 text-sm text-[#1a1a1a]/60">{doc.description}</p></Link>)}</div></div></main>
}

export function LegalPage({ type }: { type: LegalDocumentType }) {
  const doc = LEGAL_DOCUMENTS.find((item) => item.type === type)
  if (!doc) return null
  return <main className="min-h-screen bg-[#F7ECDC] p-8 text-[#1a1a1a]"><article className="mx-auto max-w-3xl"><Link to="/legal" className="font-bold text-[#C9622E]">← Legal centre</Link><div className="mt-10 rounded-2xl bg-[#FBF6EC] p-8 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-black/40">Effective 8 August 2026 · {doc.audience}</p><h1 className="mt-2 font-display text-3xl font-extrabold">{doc.title}</h1><p className="mt-3 text-[#1a1a1a]/65">{doc.description}</p>{doc.sections.map((section) => <section key={section.heading} className="mt-7"><h2 className="text-xl font-bold">{section.heading}</h2><p className="mt-2 leading-7 text-black/70">{section.body}</p></section>)}<p className="mt-9 rounded-xl bg-[#F7ECDC] p-4 text-sm text-black/60">This document is a platform template and is not legal advice. Please obtain independent legal review for your circumstances.</p></div></article></main>
}
