import * as React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Plus, X, Mail } from 'lucide-react'
import { LoopMark } from '@/components/loop-mark'
import { Whirl } from '@/components/whirl'
import { LegalFooterLinks } from '@/components/legal-footer'
import { usePageMeta } from '@/lib/use-page-meta'
import { CityScene } from '@/components/city-scene'
import { useLivingMotion } from '@/lib/living-motion'
import '@/living.css'

const SUPPORT_EMAIL = 'help@the-loyalty-loop.com'

type Item = { q: string; a: React.ReactNode }

const SHOPPER_ITEMS: Item[] = [
  {
    q: 'What is The Loyalty Loop?',
    a: 'It replaces the paper loyalty cards from your favourite independent shops with one app. Each visit earns a stamp at that shop, and a reward unlocks once your card is full.',
  },
  {
    q: 'How do my purchases count?',
    a: 'Open the shop’s loyalty card in the app and show the QR code (or read out the 6‑character code) when you pay. The shop scans it and adds your stamp, and your progress updates straight away.',
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
    a: 'Ask the shop whether they can carry over your existing progress. Each business decides how to handle its paper cards.',
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
        <Link to="/login">
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
        <a href="/legal/privacy-notice.pdf" target="_blank" rel="noreferrer" >
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
        <a href={`mailto:${SUPPORT_EMAIL}`} >
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
    <div className="lp-help-item">
      <button data-press-feedback className="lp-help-q" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {q}
        <span className="lp-help-icon">
          {open ? <X className="h-4 w-4" strokeWidth={2.5} /> : <Plus className="h-4 w-4" strokeWidth={2.5} />}
        </span>
      </button>
      {open && <div className="lp-help-a">{a}</div>}
    </div>
  )
}

function Section({ title, items }: { title: string; items: Item[] }) {
  return (
    <section className="lp-help-section">
      <div>
        <span className="lp-help-bar" aria-hidden="true" />
        <h2>{title}</h2>
      </div>
      <div className="lp-help-list lp-glass">
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

  const page = React.useRef<HTMLDivElement>(null)
  useLivingMotion(page, true)

  return (
    <div className="lp" ref={page}>
      <CityScene root={page} seed={7} skyline="low" mini />
      <a className="lp-skip" href="#main-content">Skip to content</a>
      <main id="main-content">
        <div className="lp-wrap" style={{ paddingTop: 28 }}>
          <div className="lp-help-top">
            <Link to="/" className="lp-brand">
              <span className="lp-logo-tile"><LoopMark className="h-8 w-8" /></span>
              The Loyalty Loop
            </Link>
            <Link to="/" className="lp-btn lp-btn-quiet">
              <ArrowLeft className="h-4 w-4" />
              Home
            </Link>
          </div>

          <header className="lp-page-head lp-back">
            <div className="lp-page-head-row">
              <div>
                <h1>Help &amp; FAQ</h1>
                <p className="lp-lead">Everything you need to get going with The Loyalty Loop. Can’t find your answer? We’re a real person away.</p>
                <a href={`mailto:${SUPPORT_EMAIL}`} className="lp-help-mail">
                  <Mail className="h-4 w-4" />
                  {SUPPORT_EMAIL}
                </a>
              </div>
              <Whirl pose="peek" size={112} className="lp-help-whirl" />
            </div>
          </header>

          <Section title="For shoppers" items={SHOPPER_ITEMS} />
          <Section title="For businesses" items={BUSINESS_ITEMS} />
          <Section title="Account, privacy &amp; troubleshooting" items={ACCOUNT_ITEMS} />

          <footer className="lp-help-foot">
            <p>© {new Date().getFullYear()} The Loyalty Loop. Made for the high street.</p>
            <LegalFooterLinks />
          </footer>
        </div>
      </main>
    </div>
  )
}
