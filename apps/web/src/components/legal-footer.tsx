const LEGAL_LINKS = [
  { label: 'Terms of Service', href: '/legal/terms-of-service.pdf' },
  { label: 'Privacy Notice', href: '/legal/privacy-notice.pdf' },
  { label: 'Cookie Policy', href: '/legal/cookie-policy.pdf' },
  { label: 'Merchant Agreement', href: '/legal/merchant-agreement.pdf' },
  { label: 'Data Processing Addendum', href: '/legal/data-processing-addendum.pdf' },
  { label: 'Acceptable Use Policy', href: '/legal/acceptable-use-policy.pdf' },
]

/** Links straight to the static PDFs in /public/legal — no route/page needed
 * for documents that don't change per-request. Shared between the public
 * marketing footer and the signed-in app footers so the link list only
 * needs to be kept in one place. */
export function LegalFooterLinks({ className = '' }: { className?: string }) {
  return (
    <nav aria-label="Legal" className={'flex flex-wrap items-center gap-x-4 gap-y-1.5 ' + className}>
      {LEGAL_LINKS.map((link) => (
        <a
          key={link.href}
          href={link.href}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-current/30 underline-offset-2 hover:decoration-current"
        >
          {link.label}
        </a>
      ))}
    </nav>
  )
}
