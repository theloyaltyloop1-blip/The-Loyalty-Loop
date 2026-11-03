import { useRef, type CSSProperties, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check } from 'lucide-react'
import { LoopMark } from '@/components/loop-mark'
import { LegalFooterLinks } from '@/components/legal-footer'
import { StoreBadges } from '@/components/store-badges'
import { ContextCursor, Preloader, useEasterEgg, useMagnetic, useReveal, useScrollProgress } from '@/components/poster-fx'
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

// How it works as three posters you scroll sideways through on a big screen.
const STEPS = [
  { n: '01', tone: 'blue', title: 'Find your spot.', body: 'Explore participating shops on the map and join their loyalty cards.' },
  { n: '02', tone: 'yellow', title: 'Show your code.', body: 'At the till, show your QR code or short code. Every visit adds a stamp towards your reward.' },
  { n: '03', tone: 'ocean', title: 'Enjoy your reward.', body: 'See your progress in the app. When your reward is ready, show the shop your redemption code.' },
]

const QUESTIONS = [
  ['How do my purchases count?', 'Join a participating shop’s loyalty card, then show your QR code or short code when you pay. The shop adds your stamp, and it counts towards your next reward.'],
  ['Where can I use it?', 'Open the shop map to find participating independent businesses near you. Each shop sets its own rewards and how many stamps you need to earn them.'],
  ['Does it cost anything for shoppers?', 'The Loyalty Loop is free for shoppers. Create an account to keep your participating shops’ loyalty cards together.'],
  ['Can I bring over a paper card?', 'Ask the shop whether they can carry over your existing progress. Each business decides how to handle its paper cards.'],
]

// Example cards for the hero stack. Shop names are illustrative, not real customers.
const BACK_CARDS = [
  { shop: 'Fade & Co. Barbers', reward: 'Every sixth trim free', tone: 'ocean' },
  { shop: 'Pip’s Bakehouse', reward: 'Collect 8 stamps, a loaf on us', tone: 'jade' },
]

const STAMPS_TOTAL = 10
const STAMPS_FILLED = 7

export function Landing() {
  usePageMeta({ title: 'The Loyalty Loop: keep coming back to local', description: 'Digital loyalty cards for independent shops. Earn rewards with every visit, keep track of them, and give your regular places another visit.', path: '/' })
  const page = useRef<HTMLDivElement>(null)
  const hero = useRef<HTMLElement>(null)
  const how = useRef<HTMLElement>(null)
  useReveal(page)
  useMagnetic(page)
  const heroP = useScrollProgress(hero)
  const howP = useScrollProgress(how)
  const egg = useEasterEgg()

  return (
    <div className="lp" ref={page}>
      <Preloader />
      <ContextCursor />
      {egg.node}
      <a className="lp-skip" href="#main-content">Skip to content</a>

      <header className="lp-nav">
        <div className="lp-wrap lp-nav-row">
          <Link to="/" className="lp-brand" aria-label="The Loyalty Loop home" onClick={egg.onClick}>
            <LoopMark className="h-8 w-8" />
            <span>The Loyalty Loop</span>
          </Link>
          <nav aria-label="Main navigation" className="lp-nav-links">
            {NAV_LINKS.map((link) => <a key={link.href} href={link.href} onClick={scrollToSection}>{link.label}</a>)}
            <Link to="/help">Help</Link>
          </nav>
          <Link to="/login" className="lp-btn lp-btn-quiet" data-magnetic>
            <span className="hidden sm:inline">Sign up or log in</span>
            <span className="sm:hidden">Sign in</span>
          </Link>
        </div>
      </header>

      <main id="main-content">
        <section ref={hero} className="lp-hero fx-grain">
          <div className="lp-frame" aria-hidden="true"><span>++++++</span><span>Local loyalty</span><span>2026</span></div>
          <span className="lp-hero-ghost" aria-hidden="true" style={{ transform: `translateY(${heroP * 160}px)` }}>LOOP</span>
          <div className="lp-wrap lp-hero-grid">
            <div className="lp-hero-copy">
              <p className="lp-kicker" data-reveal>Digital loyalty cards for independent shops</p>
              <h1 data-reveal style={{ '--d': 1 } as CSSProperties}>Your high street, <em>in your pocket.</em></h1>
              <p className="lp-lead" data-reveal style={{ '--d': 2 } as CSSProperties}>Keep the loyalty cards from your favourite local shops in one place, and get rewarded every time you visit.</p>
              <div className="lp-actions" data-reveal style={{ '--d': 3 } as CSSProperties}>
                <Link className="lp-btn lp-btn-primary" to="/signup" data-magnetic data-cursor="Join free">Start collecting <ArrowRight size={18} aria-hidden="true" /></Link>
              </div>
              <div data-reveal style={{ '--d': 4 } as CSSProperties}><StoreBadges className="lp-badges" /></div>
            </div>

            <div className="lp-stack" role="img" aria-label="Example loyalty card: 7 of 10 stamps at a neighbourhood café, with two more shop cards behind it" style={{ transform: `translateY(${heroP * -70}px)` }}>
              {BACK_CARDS.map((card, i) => (
                <div key={card.shop} className={`lp-card lp-card-back lp-card-${card.tone}`} style={{ '--i': i } as CSSProperties} aria-hidden="true">
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
                <p className="lp-card-sub">Collect 10 stamps. One coffee on the house.</p>
                <div className="lp-stamps">
                  {Array.from({ length: STAMPS_TOTAL }, (_, i) => (
                    <span key={i} className={i < STAMPS_FILLED ? 'lp-stamp is-filled' : 'lp-stamp'} style={{ '--s': i } as CSSProperties}>
                      {i < STAMPS_FILLED ? <Check size={18} strokeWidth={2.5} /> : null}
                    </span>
                  ))}
                </div>
                <div className="lp-card-foot"><span>7 stamps</span><span>3 to your next coffee</span></div>
              </div>
            </div>
          </div>
          <a href="#film" className="lp-scroll" onClick={scrollToSection}>Proceed scrolling ↓</a>
        </section>

        <section id="film" className="lp-wrap lp-film-wrap" aria-labelledby="lp-film-title">
          <div className="lp-film fx-grain" data-reveal>
            <h2 id="lp-film-title">From the till <em>to a free coffee.</em></h2>
            <p>Twenty seconds on how a shop records a purchase and a card fills up.</p>
            <div data-cursor="Play">
              <video className="lp-film-video" controls playsInline preload="none" poster="/video/loyalty-loop-poster.jpg" aria-label="The Loyalty Loop in 21 seconds: a shop records three purchases and the customer unlocks a free coffee">
                <source src="/video/loyalty-loop.mp4" type="video/mp4" />
              </video>
            </div>
          </div>
        </section>

        <section id="how-it-works" ref={how} className="lp-how" aria-labelledby="lp-how-title">
          <div className="lp-how-pin">
            <h2 id="lp-how-title" className="lp-wrap">Same favourite places. <em>One less thing to remember.</em></h2>
            <ol className="lp-steps" style={{ '--x': howP } as CSSProperties}>
              {STEPS.map((step) => (
                <li key={step.n} className={`lp-step lp-step-${step.tone} fx-grain`}>
                  <span className="lp-step-n" aria-hidden="true">{step.n}</span>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </li>
              ))}
            </ol>
            <div className="lp-wrap"><Link className="lp-link" to="/dashboard/discover" data-cursor="Explore">Find participating shops</Link></div>
          </div>
        </section>

        <section id="business" className="lp-wrap">
          <div className="lp-biz fx-grain">
            <div className="lp-biz-copy" data-reveal>
              <p className="lp-kicker">For shop owners</p>
              <h2>Give your regulars <em>a reason to return.</em></h2>
              <p>You know their order. We help you reward their loyalty. Choose rewards, record visits from your phone, and see how your loyalty programme is doing.</p>
              <p className="lp-biz-note">No paper cards to print or extra scanner to buy.</p>
              <div className="lp-actions">
                <Link className="lp-btn lp-btn-primary" to="/signup/owner" data-magnetic data-cursor="Start">Set up your business</Link>
                <Link className="lp-link" to="/login">Log in to your business</Link>
              </div>
              <StoreBadges app="business" className="lp-badges" />
            </div>
            <div className="lp-biz-preview" aria-hidden="true" data-reveal style={{ '--d': 2 } as CSSProperties}>
              <div className="lp-record">
                <p className="lp-record-label">Record a visit</p>
                <div className="lp-record-code"><span>Customer code</span><strong>K7P 2QD</strong></div>
                <div className="lp-record-amount"><span>Stamps</span><strong>+1</strong></div>
                <span className="lp-record-btn">Add stamp</span>
              </div>
              <div className="lp-record-toast"><Check size={16} strokeWidth={2.5} /> Stamp added. 3 more to their reward.</div>
            </div>
            <div className="lp-biz-film" data-reveal data-cursor="Play">
              <video className="lp-biz-video" controls playsInline preload="none" poster="/video/loyalty-loop-business-poster.jpg" aria-label="The Loyalty Loop for Business in 21 seconds: scan a customer's QR code, enter the amount, and they earn a reward">
                <source src="/video/loyalty-loop-business.mp4" type="video/mp4" />
              </video>
            </div>
          </div>
        </section>

        <section id="faq" className="lp-wrap lp-faq">
          <h2 data-reveal>Before your <em>next visit.</em></h2>
          <dl className="lp-qa">
            {QUESTIONS.map(([question, answer], i) => (
              <div key={question} data-reveal style={{ '--d': i } as CSSProperties}>
                <span className="lp-qa-n" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                <dt>{question}</dt>
                <dd>{answer}</dd>
              </div>
            ))}
          </dl>
          <Link className="lp-link" to="/help">Visit the help centre</Link>
        </section>

        <section className="lp-save fx-grain" aria-label="Start collecting">
          <p className="lp-save-word" data-reveal>Save<br />for<br />later<span className="lp-save-tab" aria-hidden="true" /></p>
          <div className="lp-wrap lp-save-row" data-reveal style={{ '--d': 2 } as CSSProperties}>
            <p>Every visit to your favourite shop, counted. Free for shoppers.</p>
            <Link className="lp-btn lp-btn-primary" to="/signup" data-magnetic data-cursor="Join free">Start collecting <ArrowRight size={18} aria-hidden="true" /></Link>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-wrap">
          <div className="lp-footer-top">
            <Link to="/" className="lp-brand"><LoopMark className="h-7 w-7" />The Loyalty Loop</Link>
            <p>A little loyalty goes a long way.</p>
          </div>
          <div className="lp-footer-bottom">
            <p>© {new Date().getFullYear()} The Loyalty Loop</p>
            <LegalFooterLinks />
          </div>
          <div className="lp-frame lp-frame-foot" aria-hidden="true"><span>The Loyalty Loop</span><span>Independent shops</span><span>Follow for more</span></div>
        </div>
      </footer>
    </div>
  )
}
