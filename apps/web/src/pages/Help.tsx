import * as React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Plus, X, Mail } from 'lucide-react'
import { LoopMark } from '@/components/loop-mark'
import { LegalFooterLinks } from '@/components/legal-footer'
import { usePageMeta } from '@/lib/use-page-meta'

const SUPPORT_EMAIL = 'help@the-loyalty-loop.com'

type Item = { q: string; a: React.ReactNode }

const SHOPPER_ITEMS: Item[] = [
  {
    q: 'What is The Loyalty Loop?',
    a: 'It replaces the paper loyalty cards from your favourite independent shops with one app. Each visit earns a stamp at that shop, and a reward unlocks once your card is full.',
  },
  {
    q: 'How do my purchases count?',
    a: 'Open the shop’s loyalty card in the app and show the QR code (or read out the 6‑character code) when you pay. The shop scans it and adds your stamp, and your progress updates straight away. Where the shop supports it, a linked card counts automatically.',
  },
  {
    q: 'How do I claim a reward?',
    a: 'When you reach the goal, a one‑time reward code appears on your loyalty card. Show it at the till on your next visit and the shop marks it as redeemed.',
  },
  {
    q: 'Which shops can I use it at?',
    a: 'Any independent business that has set up a card on The Loyalty Loop. Check the in‑app map to see what’s live near you. New shops join regularly.',
  },
  {
    q: 'Is it free?',
    a: 'Yes, completely free, with no ads, and we don’t sell your data.',
  },
  {
    q: 'What happens to my existing paper cards?',
    a: 'Bring your paper card in store and most shops will happily match your progress when you join their digital card. Just ask.',
  },
  {
    q: 'Can I add my loyalty card to Apple Wallet or Google Wallet?',
    a: 'Yes. On a loyalty card, tap “Add to Apple Wallet” (iPhone) or “Add to Google Wallet” (Android) to keep it one tap away on your lock screen.',
  },
]

const BUSINESS_ITEMS: Item[] = [
  {
    q: 'How do I set my shop up?',
    a: 'Create a business account in The Loyalty Loop for Business app (or at the-loyalty-loop.com/signup/owner). Add your address, pin your location on the map, write a short description and choose your reward, and you’re live to nearby shoppers in minutes.',
  },
  {
    q: 'Do I need any special hardware?',
    a: 'No. Any phone or tablet with a camera works. Scan a customer’s code, or type in their 6‑character code by hand. No card printer or terminal needed.',
  },
  {
    q: 'What kinds of loyalty programme can I run?',
    a: 'Stamp rewards: “collect 8 stamps, get a free coffee”. You choose each reward and how many stamps unlock it, can add bigger rewards at higher counts, and can change them whenever you like.',
  },
  {
    q: 'How does the AI business coaching work?',
    a: 'The app summarises your visits, reviews and reward activity into weekly wins, watch‑outs and suggested next steps. The Deep AI Business Report goes further, spotting red flags in reviews and suggesting growth ideas from your own data.',
  },
  {
    q: 'How much does it cost?',
    a: 'Nothing. The Loyalty Loop for Business is free to use, with no subscriptions or in‑app purchases.',
  },
]

const ACCOUNT_ITEMS: Item[] = [
  {
    q: 'How do I reset my password?',
    a: (
      <>
        Use the “Forgot your password?” link on the{' '}
        <Link to="/login" className="text-primary underline">
          sign‑in page
        </Link>
        . We’ll email you a secure reset link.
      </>
    ),
  },
  {
    q: 'How do I delete my account?',
    a: 'In the app, go to your profile or settings and choose “Delete my account”. For linked cards, provider removal must complete before account deletion can finish. If deletion fails, contact support so we can help complete the request. The Privacy Notice explains how retained records are handled.',
  },
  {
    q: 'What data do you collect?',
    a: (
      <>
        We use account and loyalty activity to run your rewards. If you choose Fidel card linking when available, Fidel handles card entry; we receive a card identifier, limited card details and matched purchase or refund information. We do not receive your full card number or security code, and we do not sell your data. Full detail is in our{' '}
        <a href="/legal/privacy-notice.pdf" target="_blank" rel="noreferrer" className="text-primary underline">
          Privacy Notice
        </a>
        .
      </>
    ),
  },
  {
    q: 'The app isn’t working / a purchase didn’t appear',
    a: (
      <>
        First, close and reopen the app to refresh. If a purchase or reward still looks wrong, ask the shop to check their side, then email us at{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary underline">
          {SUPPORT_EMAIL}
        </a>{' '}
        with the shop name and roughly when it happened.
      </>
    ),
  },
]

function HelpItem({ q, a }: Item) {
  const [open, setOpen] = React.useState(false)
  return (
    <div className="py-1">
      <button
        data-press-feedback
        className="flex w-full items-center justify-between gap-4 py-4 text-left text-[17px] font-semibold"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        {q}
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors duration-200 ${open ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'}`}>
          {open ? <X className="h-4 w-4" strokeWidth={2.5} /> : <Plus className="h-4 w-4" strokeWidth={2.5} />}
        </span>
      </button>
      {open && <div className="max-w-[60ch] pb-5 leading-relaxed text-muted-foreground">{a}</div>}
    </div>
  )
}

function Section({ title, items, tone }: { title: string; items: Item[]; tone: string }) {
  return (
    <section className="mt-14 grid gap-4 md:grid-cols-[220px_1fr] md:gap-10">
      <div className="md:sticky md:top-8 md:self-start">
        <span className={`mb-4 block h-1.5 w-10 rounded-full ${tone}`} aria-hidden="true" />
        <h2 className="font-display text-2xl font-bold tracking-tight">{title}</h2>
      </div>
      <div className="divide-y divide-border border-y border-border">
        {items.map((item) => (
          <HelpItem key={item.q} {...item} />
        ))}
      </div>
    </section>
  )
}

export function Help() {
  usePageMeta({
    title: 'Help & FAQ | The Loyalty Loop',
    description:
      'Answers for shoppers and businesses using The Loyalty Loop: earning rewards, claiming them, setting up your shop, accounts, privacy and troubleshooting.',
    path: '/help',
  })

  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
            <LoopMark className="h-8 w-8" />
            The Loyalty Loop
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Home
          </Link>
        </div>

        <header className="mt-8 rounded-3xl bg-olive px-6 py-10 text-olive-ink sm:px-10 sm:py-12">
          <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">Help &amp; FAQ</h1>
          <p className="mt-3 max-w-xl text-olive-ink/80">
            Everything you need to get going with The Loyalty Loop. Can’t find your answer? We’re a real person away.
          </p>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-olive-ink px-4 py-2.5 font-semibold text-olive transition-transform active:scale-[0.98]"
          >
            <Mail className="h-4 w-4" />
            {SUPPORT_EMAIL}
          </a>
        </header>

        <Section title="For shoppers" items={SHOPPER_ITEMS} tone="bg-orange" />
        <Section title="For businesses" items={BUSINESS_ITEMS} tone="bg-amber" />
        <Section title="Account, privacy &amp; troubleshooting" items={ACCOUNT_ITEMS} tone="bg-olive" />

        <footer className="mt-20 border-t border-border pt-8 text-center text-sm text-muted-foreground">
          <p className="mb-3">© {new Date().getFullYear()} The Loyalty Loop. Made for the high street.</p>
          <LegalFooterLinks className="justify-center" />
        </footer>
      </div>
    </div>
  )
}
