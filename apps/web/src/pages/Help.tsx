import * as React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Plus, X, Mail } from 'lucide-react'
import { LoopMark } from '@/components/loop-mark'
import { LegalFooterLinks } from '@/components/legal-footer'
import { usePageMeta } from '@/lib/use-page-meta'

const SUPPORT_EMAIL = 'hello@the-loyalty-loop.com'

type Item = { q: string; a: React.ReactNode }

const SHOPPER_ITEMS: Item[] = [
  {
    q: 'What is The Loyalty Loop?',
    a: 'It replaces the paper stamp cards from your favourite independent shops with one app. Collect stamps or points when you visit, and unlock a reward once you hit the shop’s goal.',
  },
  {
    q: 'How do I collect a stamp?',
    a: 'Open the shop’s loyalty card in the app and show the QR code (or read out the 6‑character code) when you pay. The shop scans it and your stamp is added straight away.',
  },
  {
    q: 'How do I claim a reward?',
    a: 'When you reach the goal, a one‑time reward code appears on your loyalty card. Show it at the till on your next visit and the shop marks it as redeemed.',
  },
  {
    q: 'Which shops can I use it at?',
    a: 'Any independent business that has set up a card on The Loyalty Loop. Check the in‑app map to see what’s live near you — new shops join regularly.',
  },
  {
    q: 'Is it free?',
    a: 'Yes, completely free for shoppers, with no ads. Shops pay a small subscription; you never pay anything and we don’t sell your data.',
  },
  {
    q: 'What happens to my existing paper cards?',
    a: 'Bring your paper card in store and most shops will happily match your progress when you join their digital card — just ask.',
  },
  {
    q: 'Can I add my loyalty card to Apple Wallet or Google Wallet?',
    a: 'Yes. On a loyalty card, tap “Add to Apple Wallet” (iPhone) or “Add to Google Wallet” (Android) to keep it one tap away on your lock screen.',
  },
]

const BUSINESS_ITEMS: Item[] = [
  {
    q: 'How do I set my shop up?',
    a: 'Create a business account in The Loyalty Loop for Business app (or at the-loyalty-loop.com/signup/owner). Add your address, pin your location on the map, write a short description and choose your reward — you’re live to nearby shoppers in minutes.',
  },
  {
    q: 'Do I need any special hardware?',
    a: 'No. Any phone or tablet with a camera works. Scan a customer’s code, or type in their 6‑character code by hand — no card printer or terminal needed.',
  },
  {
    q: 'What kinds of loyalty programme can I run?',
    a: 'Stamp cards (“collect 8, get a free coffee”), points, or visit‑based rewards. You set the goal and the reward, and can change them whenever you like.',
  },
  {
    q: 'How does the AI business coaching work?',
    a: 'The app summarises your visits, reviews and reward activity into weekly wins, watch‑outs and suggested next steps. The Deep AI Business Report goes further — spotting red flags in reviews and suggesting growth ideas from your own data.',
  },
  {
    q: 'How much does it cost?',
    a: 'It’s free to get started. Contact us for current subscription pricing for your business.',
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
    a: 'In the app, go to your profile or settings and choose “Delete my account”. This permanently removes your account and personal data. You can also email us and we’ll do it for you.',
  },
  {
    q: 'What data do you collect?',
    a: (
      <>
        Only what’s needed to run your loyalty cards — never your card numbers, and we don’t sell your data. Full detail is in our{' '}
        <a href="/legal/privacy-notice.pdf" target="_blank" rel="noreferrer" className="text-primary underline">
          Privacy Notice
        </a>
        .
      </>
    ),
  },
  {
    q: 'The app isn’t working / a stamp didn’t appear',
    a: (
      <>
        First, close and reopen the app to refresh. If a stamp or reward still looks wrong, ask the shop to check their side, then email us at{' '}
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
    <div className="rounded-xl border border-border bg-card p-5">
      <button
        data-press-feedback
        className="flex w-full items-center justify-between gap-4 text-left font-display text-lg font-bold"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        {q}
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-[2.5px] border-foreground ${
            open ? 'bg-accent' : 'bg-card'
          }`}
        >
          {open ? <X className="h-4 w-4" strokeWidth={3} /> : <Plus className="h-4 w-4" strokeWidth={3} />}
        </span>
      </button>
      {open && <div className="mt-3 leading-relaxed text-foreground/70">{a}</div>}
    </div>
  )
}

function Section({ title, items }: { title: string; items: Item[] }) {
  return (
    <section className="mt-10">
      <h2 className="mb-4 font-display text-2xl font-extrabold text-foreground">{title}</h2>
      <div className="flex flex-col gap-3">
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
      'Answers for shoppers and businesses using The Loyalty Loop — collecting stamps, claiming rewards, setting up your shop, accounts, privacy and troubleshooting.',
    path: '/help',
  })

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
        <div className="flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-extrabold">
            <LoopMark className="h-9 w-9" />
            The Loyalty Loop
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground/60 hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Home
          </Link>
        </div>

        <header className="mt-10">
          <h1 className="font-display text-4xl font-extrabold text-foreground sm:text-5xl">Help &amp; FAQ</h1>
          <p className="mt-3 max-w-xl text-foreground/70">
            Everything you need to get going with The Loyalty Loop. Can’t find your answer? We’re a real person away.
          </p>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="mt-5 inline-flex items-center gap-2 rounded-xl border-[1.5px] border-foreground/20 bg-card px-4 py-2.5 font-bold text-foreground transition-colors hover:border-foreground/40"
          >
            <Mail className="h-4 w-4" />
            {SUPPORT_EMAIL}
          </a>
        </header>

        <Section title="For shoppers" items={SHOPPER_ITEMS} />
        <Section title="For businesses" items={BUSINESS_ITEMS} />
        <Section title="Account, privacy &amp; troubleshooting" items={ACCOUNT_ITEMS} />

        <footer className="mt-16 border-t-[3px] border-foreground/10 pt-8 text-center text-sm text-foreground/60">
          <p className="mb-3">© {new Date().getFullYear()} The Loyalty Loop. Made for the high street.</p>
          <LegalFooterLinks className="justify-center" />
        </footer>
      </div>
    </div>
  )
}
