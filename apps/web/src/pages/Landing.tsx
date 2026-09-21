import { Link } from 'react-router-dom'
import { ArrowUpRight, Check } from 'lucide-react'
import { LoopMark } from '@/components/loop-mark'
import { LegalFooterLinks } from '@/components/legal-footer'
import { usePageMeta } from '@/lib/use-page-meta'
import './landing.css'

const questions = [
  ['How do I collect a stamp?', 'Join a participating shop’s loyalty card, then show your QR code or short code when you pay. The shop adds your stamps or points to your account.'],
  ['Where can I use it?', 'Open the shop map to find participating independent businesses near you. Each shop sets its own rewards and the visits or points needed to earn them.'],
  ['Does it cost anything for shoppers?', 'The Loyalty Loop is free for shoppers. Create an account to keep your participating shops’ loyalty cards together.'],
  ['Can I bring over a paper card?', 'Ask the shop whether they can transfer your existing stamps. Each business decides how to handle its paper cards.'],
]

export function Landing() {
  usePageMeta({ title: 'The Loyalty Loop — keep coming back to local', description: 'Digital loyalty cards for independent shops. Collect stamps, keep track of your rewards, and give your regular places another visit.', path: '/' })
  return (
    <div className="ll-home">
      <a className="ll-skip" href="#main-content">Skip to content</a>
      <header className="ll-header ll-wrap">
        <Link to="/" className="ll-brand" aria-label="The Loyalty Loop home"><LoopMark className="h-8 w-8" /><span>The Loyalty Loop</span></Link>
        <nav aria-label="Main navigation"><a href="#how-it-works">How it works</a><a href="#business">For business</a><Link to="/help">Help</Link></nav>
        <Link to="/login" className="ll-login">Log in <ArrowUpRight size={16} aria-hidden="true" /></Link>
      </header>
      <main id="main-content">
        <section className="ll-hero ll-wrap">
          <div className="ll-hero-copy">
            <p className="ll-eyebrow">Independent shops. Familiar faces.</p>
            <h1>Good places.<br />Worth coming<br /><em>back to.</em></h1>
            <p className="ll-intro">The morning coffee. The usual haircut. The little shop round the corner. Keep their loyalty cards in one place, and make every visit count.</p>
            <div className="ll-actions"><Link className="ll-action" to="/signup">Start collecting <ArrowUpRight size={19} aria-hidden="true" /></Link><a className="ll-text-link" href="#how-it-works">Take a look below <span aria-hidden="true">↓</span></a></div>
            <p className="ll-small">Free for shoppers. Made for the high street.</p>
          </div>
          <div className="ll-card-scene">
            <div className="ll-scene-label"><span>A little thank you for coming back.</span><span aria-hidden="true">01 / 10</span></div>
            <div className="ll-paper-card">
              <div className="ll-card-top"><span>Your neighbourhood café</span><LoopMark className="h-8 w-8" /></div>
              <p className="ll-card-title">The usual,<br /><em>please.</em></p>
              <p className="ll-card-subtitle">Ten stamps. One coffee on the house.</p>
              <div className="ll-stamps" aria-label="Example loyalty card: 7 of 10 stamps collected">{Array.from({ length: 10 }, (_, i) => <span key={i} className={i < 7 ? 'll-stamp ll-stamped' : 'll-stamp'} aria-hidden="true">{i < 7 ? <Check size={24} strokeWidth={1.5} /> : String(i + 1).padStart(2, '0')}</span>)}</div>
              <div className="ll-card-bottom"><span>7 collected</span><span>3 to your next coffee</span></div>
            </div>
            <p className="ll-example">An example card. Each shop chooses its own rewards.</p>
          </div>
        </section>
        <div className="ll-strip"><div className="ll-wrap"><span>Less paper in your pocket.</span><span>More reasons to shop local.</span></div></div>
        <section id="how-it-works" className="ll-how ll-wrap">
          <div className="ll-section-heading"><p className="ll-eyebrow">The everyday routine</p><h2>Same favourite places.<br />One less thing to remember.</h2></div>
          <div className="ll-steps">{[
            ['01', 'Find your spot.', 'Explore participating shops on the map and join their loyalty cards.'],
            ['02', 'Show your code.', 'At the till, show your QR code or short code. The shop takes care of the stamp.'],
            ['03', 'Enjoy your reward.', 'See your progress in the app. When your reward is ready, show the shop your redemption code.'],
          ].map(([number, title, body]) => <article key={number}><span className="ll-step-number">{number}</span><h3>{title}</h3><p>{body}</p></article>)}</div>
          <Link className="ll-text-link" to="/dashboard/discover">Find participating shops <ArrowUpRight size={17} aria-hidden="true" /></Link>
        </section>
        <section id="business" className="ll-business"><div className="ll-wrap ll-business-grid">
          <div><p className="ll-eyebrow">On the other side of the counter?</p><h2>Give your regulars<br />a reason to return.</h2><Link className="ll-action ll-action-light" to="/signup/owner">Set up your business <ArrowUpRight size={19} aria-hidden="true" /></Link></div>
          <div className="ll-business-copy"><p>You know their order. We help you keep track of the visits.</p><p>Choose a reward that works for your shop, add stamps from your phone, and see how your loyalty programme is doing. No paper cards to print or extra scanner to buy.</p><ul><li>Your shop. Your rewards.</li><li>Stamps, points or visit-based loyalty.</li><li>A shared workspace for owners and staff.</li></ul><Link className="ll-text-link" to="/login">Already have a business account? Log in <ArrowUpRight size={16} aria-hidden="true" /></Link></div>
        </div></section>
        <section id="faq" className="ll-faq ll-wrap"><div><p className="ll-eyebrow">A few useful details</p><h2>Before your<br />next visit.</h2><Link className="ll-text-link" to="/help">Visit the help centre <ArrowUpRight size={17} aria-hidden="true" /></Link></div><div className="ll-questions">{questions.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></section>
      </main>
      <footer className="ll-footer ll-wrap"><div className="ll-footer-top"><Link to="/" className="ll-brand"><LoopMark className="h-8 w-8" />The Loyalty Loop</Link><p>A little loyalty goes a long way.</p></div><div className="ll-footer-bottom"><p>© {new Date().getFullYear()} The Loyalty Loop</p><LegalFooterLinks /></div></footer>
    </div>
  )
}
