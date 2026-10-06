import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Gift, Image, ScanLine, Sparkles, Wrench } from 'lucide-react'
import { OwnerLayout } from '@/components/owner-layout'
import { useOwner } from '@/lib/owner-context'

const TONES = ['bg-sage text-sage-ink', 'bg-peach text-peach-ink', 'bg-amber text-amber-ink', 'bg-olive text-olive-ink', 'bg-orange text-orange-ink']

const steps = [
  { icon: Image, title: 'Finish your shop profile', body: 'Add your description, address, logo and cover image so customers can recognise your shop.', to: '/owner/settings', action: 'Open shop settings' },
  { icon: Gift, title: 'Create rewards', body: 'Add at least one reward, for example “Free coffee” after 8 stamps. Scanning unlocks once a reward is ready.', to: '/owner/settings', action: 'Set up rewards' },
  { icon: Wrench, title: 'Invite customers', body: 'Create your dedicated QR poster and place it beside the till so customers can join your card.', to: '/owner/tools', action: 'Open growth tools' },
  { icon: ScanLine, title: 'Award progress at the counter', body: 'Open Scan, scan the shopper’s QR code or type their manual code, choose the amount, then award it.', to: '/owner/scan', action: 'Open scan' },
  { icon: Sparkles, title: 'Keep customers coming back', body: 'Use announcements for shop updates, reviews for replies, and analytics to understand activity.', to: '/owner', action: 'View analytics' },
]

export function OwnerTutorial() {
  const { business } = useOwner()
  return (
    <OwnerLayout>
      <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Get your loyalty programme running</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">A quick guide for {business?.name ?? 'your shop'}. Complete these in order, then use Scan whenever a customer visits.</p>

      <ol className="mt-8 grid gap-4">
        {steps.map(({ icon: Icon, title, body, to, action }, index) => (
          <li key={title} className="flex gap-4 rounded-2xl bg-card p-5 ring-1 ring-foreground/8 sm:items-center sm:p-6">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${TONES[index % TONES.length]}`}><Icon className="h-5 w-5" aria-hidden="true" /></div>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">{title}</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{body}</p>
              <Link to={to} className="group mt-3 inline-flex items-center gap-1 text-sm font-semibold text-foreground underline decoration-primary/60 decoration-[1.5px] underline-offset-4 transition-colors hover:decoration-primary">
                {action}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-6 flex items-start gap-3 rounded-2xl bg-olive p-5 text-olive-ink">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
        <p><strong>Ready to go?</strong> Record a small test purchase on your own shopper account, then scan a real customer card at the till.</p>
      </div>
    </OwnerLayout>
  )
}
