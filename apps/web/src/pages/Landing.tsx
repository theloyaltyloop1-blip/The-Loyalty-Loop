import * as React from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Search,
  Stamp,
  Gift,
  Check,
  Plus,
  X,
  Coffee,
  Croissant,
  Scissors,
  Pizza,
  Sparkles,
} from 'lucide-react'
import { LoopMark } from '@/components/loop-mark'
import { ShopRowIllustration } from '@/components/shop-row-illustration'
import { Button } from '@/components/ui/button'
import { LegalFooter } from '@/pages/Legal'

const NAV_LINKS = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Shops', href: '#shops' },
  { label: 'FAQ', href: '#faq' },
  { label: 'For business', href: '#business' },
]

const STEPS = [
  {
    icon: Search,
    color: 'bg-accent',
    step: 'STEP 1',
    title: 'Discover',
    description: 'Browse shops, cafés and studios near you on a friendly map.',
  },
  {
    icon: Stamp,
    color: 'bg-fun-green',
    step: 'STEP 2',
    title: 'Collect',
    description: 'Tap to add a stamp or earn points every time you visit.',
    textLight: true,
  },
  {
    icon: Gift,
    color: 'bg-primary',
    step: 'STEP 3',
    title: 'Redeem',
    description: 'Hit the goal and a one-time reward code appears in the app.',
    textLight: true,
  },
]

const SHOPS = [
  {
    icon: Coffee,
    color: 'bg-primary',
    name: 'Bean & Bird',
    meta: 'Coffee · Tooting',
    filled: 7,
    total: 10,
    dotColor: 'bg-primary',
    reward: 'Reward · Free flat white',
  },
  {
    icon: Croissant,
    color: 'bg-accent',
    name: 'Maison Loaf',
    meta: 'Bakery · Balham',
    filled: 4,
    total: 6,
    dotColor: 'bg-accent',
    reward: 'Reward · Free croissant',
  },
  {
    icon: Scissors,
    color: 'bg-fun-violet',
    name: 'Buzz Cuts',
    meta: 'Barber · SW17',
    filled: 9,
    total: 10,
    dotColor: 'bg-fun-violet',
    reward: 'Reward · £10 off cut',
  },
  {
    icon: Pizza,
    color: 'bg-fun-green',
    name: 'Slice St.',
    meta: 'Pizza · Balham',
    filled: 3,
    total: 8,
    dotColor: 'bg-fun-green',
    reward: 'Reward · Free side',
  },
]

const BUSINESS_PERKS = ['Printable QR poster', 'Built-in promos', 'Customer analytics', 'Cancel anytime']

const FAQS = [
  {
    q: 'Is it really free for shoppers?',
    a: 'Yep — forever. Shops pay a small monthly fee, you pay nothing. No ads, no selling your data.',
  },
  {
    q: 'Which shops can I use it at?',
    a: 'Any independent shop that has set up a card on The Loyalty Loop — check the map to see what’s live near you.',
  },
  {
    q: 'What happens to my paper stamp cards?',
    a: 'Bring in your existing paper card and most shops will happily match your progress — ask in store.',
  },
]

function ShopDots({ filled, total, color }: { filled: number; total: number; color: string }) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-8 w-8 rounded-full border-[2.5px] border-foreground flex items-center justify-center ${
            i < filled ? `${color} text-white` : 'bg-card'
          }`}
        >
          {i < filled && <Check className="h-4 w-4" strokeWidth={3} />}
        </div>
      ))}
    </div>
  )
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = React.useState(false)
  return (
    <div className="rounded-[1.25rem] border-[3px] border-foreground bg-card p-5">
      <button
        className="w-full flex items-center justify-between gap-4 text-left font-display font-bold text-lg"
        onClick={() => setOpen((o) => !o)}
      >
        {q}
        <span
          className={`shrink-0 h-8 w-8 rounded-full border-[2.5px] border-foreground flex items-center justify-center ${
            open ? 'bg-accent' : 'bg-card'
          }`}
        >
          {open ? <X className="h-4 w-4" strokeWidth={3} /> : <Plus className="h-4 w-4" strokeWidth={3} />}
        </span>
      </button>
      {open && <p className="mt-3 text-foreground/70">{a}</p>}
    </div>
  )
}

export function Landing() {
  return (
    <div className="min-h-screen overflow-x-hidden">
      <div className="max-w-6xl mx-auto px-4 py-4 sticky top-0 z-30">
        <header className="flex items-center justify-between gap-4 rounded-full border-[3px] border-foreground bg-card px-4 py-2 shadow-sticker">
          <Link to="/" className="flex items-center gap-2 font-display font-extrabold text-lg">
            <LoopMark className="h-9 w-9" />
            The Loyalty Loop
          </Link>
          <nav className="hidden md:flex items-center gap-7 font-semibold text-sm">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="hover:text-primary transition-colors">
                {link.label}
              </a>
            ))}
          </nav>
          <Link to="/login" className="shrink-0">
            <Button size="sm" className="bg-foreground text-background border-foreground">
              <span className="hidden sm:inline">Sign up or log in</span><span className="sm:hidden">Sign in</span>
            </Button>
          </Link>
        </header>
      </div>

      <main className="max-w-6xl mx-auto px-4">
        {/* hero */}
        <section className="grid md:grid-cols-2 gap-10 items-center py-10 md:py-16">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border-[3px] border-foreground bg-accent px-4 py-1.5 font-bold text-sm mb-6">
              <Sparkles className="h-4 w-4" /> SW17 · SW12 · now live
            </span>
            <h1 className="text-4xl sm:text-5xl md:text-6xl leading-[1.05] mb-6">
              Your high street,{' '}
              <em className="text-primary not-italic font-display italic underline decoration-4 decoration-foreground/20 underline-offset-8">
                in your
              </em>{' '}
              <em className="text-primary not-italic font-display italic underline decoration-4 decoration-foreground/20 underline-offset-8">
                pocket.
              </em>
            </h1>
            <p className="text-lg text-foreground/70 mb-8 max-w-md">
              One little app for every coffee, croissant and haircut from Tooting Bec to Balham Hill.
              Collect stamps. Unlock rewards. Keep it local.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link to="/signup">
                <Button size="lg">
                  Get started <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <a href="#shops">
                <Button size="lg" variant="outline">
                  Browse shops
                </Button>
              </a>
            </div>
          </div>

          <div className="relative">
            <div className="rounded-[1.75rem] border-[3px] border-foreground bg-card p-4 shadow-sticker-lifted">
              <ShopRowIllustration className="w-full h-auto" />
            </div>

            <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-accent border-[3px] border-foreground shadow-sticker flex flex-col items-center justify-center text-center rotate-6">
              <span className="font-display font-extrabold text-sm leading-none">FREE</span>
              <span className="text-[10px] font-bold uppercase leading-none mt-1">to join</span>
            </div>

            <div className="absolute -bottom-8 -left-6 w-56 rounded-[1.25rem] border-[3px] border-foreground bg-card p-4 shadow-sticker -rotate-3">
              <div className="flex items-center gap-2 mb-3">
                <span className="h-8 w-8 rounded-full bg-primary text-white border-2 border-foreground flex items-center justify-center">
                  <Coffee className="h-4 w-4" />
                </span>
                <span className="font-display font-bold text-sm">Bean & Bird</span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-6 w-6 rounded-full border-2 border-foreground flex items-center justify-center ${
                      i < 7 ? 'bg-primary text-white' : 'bg-background'
                    }`}
                  >
                    {i < 7 && <Check className="h-3 w-3" strokeWidth={3} />}
                  </div>
                ))}
              </div>
              <p className="text-[11px] font-bold uppercase mt-3 text-foreground/60">3 more for a free flat white</p>
            </div>
          </div>
        </section>

        {/* how it works */}
        <section id="how-it-works" className="py-16 text-center">
          <span className="inline-block rounded-full border-[3px] border-foreground bg-card px-4 py-1 font-bold text-sm mb-4">
            HOW IT WORKS
          </span>
          <h2 className="text-4xl md:text-5xl mb-3">Three taps to a free flat white</h2>
          <p className="text-foreground/70 mb-10">No more bulging wallets full of paper cards. Here's the loop.</p>

          <div className="grid md:grid-cols-3 gap-6 text-left mb-10">
            {STEPS.map(({ icon: Icon, color, step, title, description, textLight }) => (
              <div
                key={title}
                className={`rounded-[1.25rem] border-[3px] border-foreground p-6 shadow-sticker ${color} ${
                  textLight ? 'text-white' : 'text-foreground'
                }`}
              >
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white border-[2.5px] border-foreground text-foreground mb-4">
                  <Icon className="h-6 w-6" />
                </span>
                <p className="text-xs font-bold uppercase opacity-70 mb-1">{step}</p>
                <h3 className="text-2xl mb-1">{title}</h3>
                <p className={textLight ? 'text-white/90' : 'text-foreground/70'}>{description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* shops */}
        <section id="shops" className="py-10">
          <div className="flex items-end justify-between mb-6 flex-wrap gap-2">
            <div>
              <span className="inline-block rounded-full border-[3px] border-foreground bg-card px-4 py-1 font-bold text-sm mb-4">
                ON YOUR STREET
              </span>
              <h2 className="text-4xl">A few loops you'll love</h2>
            </div>
            <a href="#" className="font-bold text-primary flex items-center gap-1">
              See all shops <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {SHOPS.map(({ icon: Icon, color, name, meta, filled, total, dotColor, reward }) => (
              <div key={name} className="rounded-[1.25rem] border-[3px] border-foreground bg-card overflow-hidden shadow-sticker">
                <div className={`${color} text-white px-4 py-3 flex items-center justify-between`}>
                  <Icon className="h-5 w-5" />
                  <span className="rounded-full bg-white/90 text-foreground text-xs font-bold px-2.5 py-1 border-[2px] border-foreground">
                    {filled}/{total}
                  </span>
                </div>
                <div className="p-4">
                  <h3 className="font-display font-bold text-lg">{name}</h3>
                  <p className="text-xs text-foreground/60 mb-3">{meta}</p>
                  <ShopDots filled={filled} total={Math.min(total, 5)} color={dotColor} />
                  {total > 5 && (
                    <div className="mt-2">
                      <ShopDots filled={Math.max(filled - 5, 0)} total={total - 5} color={dotColor} />
                    </div>
                  )}
                  <p className="text-[11px] font-bold uppercase text-foreground/50 mt-3">{reward}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="py-16 grid md:grid-cols-[1fr_1.4fr] gap-10">
          <div>
            <span className="inline-block rounded-full border-[3px] border-foreground bg-card px-4 py-1 font-bold text-sm mb-4">
              FAQ
            </span>
            <h2 className="text-4xl mb-3">Questions from the queue</h2>
            <p className="text-foreground/70 mb-8">
              Can't find what you're after? <a href="mailto:hello@theloyaltyloop.app" className="text-primary underline">Drop us a line</a>.
            </p>
            <span className="inline-flex h-16 w-16 rounded-full bg-primary text-white items-center justify-center border-[3px] border-foreground">
              <Sparkles className="h-7 w-7" />
            </span>
          </div>
          <div className="flex flex-col gap-4">
            {FAQS.map((faq) => (
              <FaqItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </div>
        </section>

        {/* business CTA */}
        <section id="business" className="py-10">
          <div className="relative rounded-[1.75rem] border-[3px] border-foreground bg-fun-violet text-white p-8 md:p-10 overflow-hidden">
            <div className="absolute top-6 right-10 h-20 w-20 rounded-full bg-accent border-[3px] border-foreground text-foreground flex items-center justify-center text-[11px] font-extrabold uppercase rotate-12">
              Signup
            </div>
            <span className="inline-block rounded-full border-[3px] border-foreground bg-white text-foreground px-4 py-1 font-bold text-sm mb-4">
              FOR LOCAL BUSINESSES
            </span>
            <h2 className="text-3xl md:text-4xl max-w-lg mb-4">
              A loyalty programme that fits in your apron pocket.
            </h2>
            <p className="max-w-lg text-white/90 mb-6">
              Set up your stamp card in five minutes. Send promos straight to regulars without shouting on
              social media. Live now in Tooting & Balham.
            </p>

            <div className="grid md:grid-cols-[1fr_auto] gap-4 items-start mb-6">
              <div className="rounded-[1.25rem] border-[3px] border-foreground bg-white text-foreground px-4 py-3 font-semibold text-sm max-w-md">
                ⚡ Sign up, set up your stamp card, and you're live to neighbours straight away — no waiting.
              </div>
              <Link to="/signup/owner">
                <Button variant="accent" size="lg" className="whitespace-nowrap">
                  Open business portal <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-2 max-w-md">
              {BUSINESS_PERKS.map((perk) => (
                <div key={perk} className="flex items-center gap-2 font-semibold text-sm">
                  <span className="h-5 w-5 rounded-full bg-accent text-foreground flex items-center justify-center shrink-0">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  {perk}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t-[3px] border-foreground/10 px-6 py-8 text-center text-sm text-foreground/60">
        <p>© {new Date().getFullYear()} The Loyalty Loop. Made for the high street.</p>
        <LegalFooter className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-2 font-semibold" />
      </footer>
    </div>
  )
}
