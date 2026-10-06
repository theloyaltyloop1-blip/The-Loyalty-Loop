import type { MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, Gift, MapPin, QrCode } from 'lucide-react'
import { LoopMark } from '@/components/loop-mark'
import { LegalFooterLinks } from '@/components/legal-footer'
import { StoreBadges } from '@/components/store-badges'
import { usePageMeta } from '@/lib/use-page-meta'
import './landing.css'

const NAV_LINKS = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'For business', href: '#business' },
  { label: 'FAQs', href: '#faq' },
]

function scrollToSection(event: MouseEvent<HTMLAnchorElement>) {
  const hash = event.currentTarget.hash
  const target = hash ? document.getElementById(hash.slice(1)) : null
  if (!target) return
  event.preventDefault()
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  window.history.replaceState(null, '', hash)
}

const STEPS = [
  { icon: MapPin, tone: 'sage', title: 'Find your spot.', body: 'Explore participating shops on the map and join their loyalty cards.' },
  { icon: QrCode, tone: 'amber', title: 'Show your code.', body: 'At the till, show your QR code or short code. What you spend counts towards your reward.' },
  { icon: Gift, tone: 'orange', title: 'Enjoy your reward.', body: 'See your progress in the app. When your reward is ready, show the shop your redemption code.' },
]

const QUESTIONS = [
  ['How do my purchases count?', 'Join a participating shop’s loyalty card, then show your QR code or short code when you pay. The shop adds what you spent, and it counts towards your next reward.'],
  ['Where can I use it?', 'Open the shop map to find participating independent businesses near you. Each shop sets its own rewards and how much you spend to earn them.'],
  ['Does it cost anything for shoppers?', 'The Loyalty Loop is free for shoppers. Create an account to keep your participating shops’ loyalty cards together.'],
  ['Can I bring over a paper card?', 'Ask the shop whether they can carry over your existing progress. Each business decides how to handle its paper cards.'],
]

// Example cards for the hero stack. Shop names are illustrative, not real customers.
const BACK_CARDS = [
  { shop: 'Fade & Co. Barbers', reward: 'Every sixth trim free', tone: 'amber' },
  { shop: 'Pip’s Bakehouse', reward: 'Spend £15, a loaf on us', tone: 'orange' },
]

const STAMPS_TOTAL = 10
const STAMPS_FILLED = 7

export function Landing() {
  usePageMeta({ title: 'The Loyalty Loop: keep coming back to local', description: 'Digital loyalty cards for independent shops. Earn rewards as you spend, keep track of them, and give your regular places another visit.', path: '/' })
  return (
    <div className="lp">
      <a className="lp-skip" href="#main-content">Skip to content</a>

      <header className="lp-nav">
        <div className="lp-wrap lp-nav-row">
          <Link to="/" className="lp-brand" aria-label="The Loyalty Loop home">
            <LoopMark className="h-8 w-8" />
            <span>The Loyalty Loop</span>
          </Link>
          <nav aria-label="Main navigation" className="lp-nav-links">
            {NAV_LINKS.map((link) => <a key={link.href} href={link.href} onClick={scrollToSection}>{link.label}</a>)}
            <Link to="/help">Help</Link>
          </nav>
          <Link to="/login" className="lp-btn lp-btn-quiet">
            <span className="hidden sm:inline">Sign up or log in</span>
            <span className="sm:hidden">Sign in</span>
          </Link>
        </div>
      </header>

      <main id="main-content">
        <section className="lp-wrap lp-hero">
          <div className="lp-hero-copy">
            <h1>Your high street, in your pocket.</h1>
            <p className="lp-lead">Keep the loyalty cards from your favourite local shops in one place, and get rewarded as you spend.</p>
            <div className="lp-actions">
              <Link className="lp-btn lp-btn-primary" to="/signup">Start collecting <ArrowRight size={18} aria-hidden="true" /></Link>
            </div>
            <StoreBadges className="lp-badges" />
          </div>

          <div className="lp-stack" role="img" aria-label="Example loyalty card: £14 of £20 spent at a neighbourhood café, with two more shop cards behind it">
            {BACK_CARDS.map((card, i) => (
              <div key={card.shop} className={`lp-card lp-card-back lp-card-${card.tone}`} style={{ '--i': i } as React.CSSProperties} aria-hidden="true">
                <span className="lp-card-shop">{card.shop}</span>
                <span className="lp-card-reward">{card.reward}</span>
              </div>
            ))}
            <div className="lp-card lp-card-front" aria-hidden="true">
              <div className="lp-card-top">
                <span className="lp-card-shop">Marlow Street Coffee</span>
                <LoopMark className="h-7 w-7" />
              </div>
              <p className="lp-card-title">The usual, please.</p>
              <p className="lp-card-sub">Spend £20. One coffee on the house.</p>
              <div className="lp-stamps">
                {Array.from({ length: STAMPS_TOTAL }, (_, i) => (
                  <span key={i} className={i < STAMPS_FILLED ? 'lp-stamp is-filled' : 'lp-stamp'} style={{ '--s': i } as React.CSSProperties}>
                    {i < STAMPS_FILLED ? <Check size={18} strokeWidth={2.25} /> : null}
                  </span>
                ))}
              </div>
              <div className="lp-card-foot"><span>£14 spent</span><span>£6 to your next coffee</span></div>
            </div>
          </div>
        </section>

        <section className="lp-wrap lp-reveal" aria-labelledby="lp-film-title">
          <div className="lp-film">
            <h2 id="lp-film-title">From the till to a free coffee.</h2>
            <p>Twenty seconds on how a shop records a purchase and a card fills up.</p>
            <video className="lp-film-video" controls playsInline preload="none" poster="/video/loyalty-loop-poster.jpg" aria-label="The Loyalty Loop in 21 seconds: a shop records three purchases and the customer unlocks a free coffee">
              <source src="/video/loyalty-loop.mp4" type="video/mp4" />
            </video>
          </div>
        </section>

        <section id="how-it-works" className="lp-wrap lp-how lp-reveal">
          <h2>Same favourite places. One less thing to remember.</h2>
          <ol className="lp-steps">
            {STEPS.map(({ icon: Icon, tone, title, body }) => (
              <li key={title}>
                <span className={`lp-step-icon lp-tone-${tone}`}><Icon size={22} strokeWidth={1.75} aria-hidden="true" /></span>
                <h3>{title}</h3>
                <p>{body}</p>
              </li>
            ))}
          </ol>
          <Link className="lp-link" to="/dashboard/discover">Find participating shops</Link>
        </section>

        <section id="business" className="lp-wrap lp-reveal">
          <div className="lp-biz">
            <div className="lp-biz-preview" aria-hidden="true">
              <div className="lp-record">
                <p className="lp-record-label">Record a purchase</p>
                <div className="lp-record-code"><span>Customer code</span><strong>K7P 2QD</strong></div>
                <div className="lp-record-amount"><span>Amount</span><strong>£6.40</strong></div>
                <span className="lp-record-btn">Add to card</span>
              </div>
              <div className="lp-record-toast"><Check size={16} strokeWidth={2.5} /> Added. £3.60 to their next reward.</div>
            </div>
            <div className="lp-biz-copy">
              <h2>Give your regulars a reason to return.</h2>
              <p>You know their order. We help you reward what they spend. Choose rewards, record purchases from your phone, and see how your loyalty programme is doing.</p>
              <p className="lp-biz-note">No paper cards to print or extra scanner to buy.</p>
              <div className="lp-actions">
                <Link className="lp-btn lp-btn-primary" to="/signup/owner">Set up your business</Link>
                <Link className="lp-link" to="/login">Log in to your business</Link>
              </div>
              <StoreBadges app="business" className="lp-badges" />
            </div>
            <div className="lp-biz-film">
              <video className="lp-biz-video" controls playsInline preload="none" poster="/video/loyalty-loop-business-poster.jpg" aria-label="The Loyalty Loop for Business in 21 seconds: scan a customer's QR code, enter the amount, and they earn a reward">
                <source src="/video/loyalty-loop-business.mp4" type="video/mp4" />
              </video>
            </div>
          </div>
        </section>

        <section id="faq" className="lp-wrap lp-faq lp-reveal">
          <h2>Before your next visit.</h2>
          <dl className="lp-qa">
            {QUESTIONS.map(([question, answer]) => (
              <div key={question}>
                <dt>{question}</dt>
                <dd>{answer}</dd>
              </div>
            ))}
          </dl>
          <Link className="lp-link" to="/help">Visit the help centre</Link>
        </section>
      </main>

      <footer className="lp-wrap lp-footer">
        <div className="lp-footer-top">
          <Link to="/" className="lp-brand"><LoopMark className="h-7 w-7" />The Loyalty Loop</Link>
          <p>A little loyalty goes a long way.</p>
        </div>
        <div className="lp-footer-bottom">
          <p>© {new Date().getFullYear()} The Loyalty Loop</p>
          <LegalFooterLinks />
        </div>
      </footer>
    </div>
  )
}
