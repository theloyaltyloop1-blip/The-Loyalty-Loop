import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Gift, Image, ScanLine, Sparkles, Wrench } from 'lucide-react'
import { OwnerLayout } from '@/components/owner-layout'
import { useOwner } from '@/lib/owner-context'

const steps = [
  { icon: Image, title: 'Finish your shop profile', body: 'Add your description, address, logo and cover image so customers can recognise your shop.', to: '/owner/settings', action: 'Open shop settings' },
  { icon: Gift, title: 'Create rewards', body: 'Add at least one reward, for example “Free coffee” after 10 stamps. Scanning unlocks once a reward is ready.', to: '/owner/settings', action: 'Set up rewards' },
  { icon: Wrench, title: 'Invite customers', body: 'Create your dedicated QR poster and place it beside the till so customers can join your card.', to: '/owner/tools', action: 'Open growth tools' },
  { icon: ScanLine, title: 'Award progress at the counter', body: 'Open Scan, scan the shopper’s QR code or type their manual code, choose the amount, then award it.', to: '/owner/scan', action: 'Open scan' },
  { icon: Sparkles, title: 'Keep customers coming back', body: 'Use announcements for shop updates, reviews for replies, and analytics to understand activity.', to: '/owner', action: 'View analytics' },
]

export function OwnerTutorial() {
  const { business } = useOwner()
  return (
    <OwnerLayout>
      <p className="mb-1 text-xs font-extrabold uppercase tracking-wide text-foreground/40">Business guide</p>
      <h1 className="font-display text-3xl font-extrabold text-foreground">Get your loyalty programme running</h1>
      <p className="mt-2 max-w-2xl text-foreground/60">A quick guide for {business?.name ?? 'your shop'}. Complete these in order, then use Scan whenever a customer visits.</p>

      <section className="mt-7 grid gap-4">
        {steps.map(({ icon: Icon, title, body, to, action }, index) => (
          <article key={title} className="flex gap-4 rounded-2xl bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,.08)] sm:items-center sm:p-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-extrabold text-primary">{index + 1}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2"><Icon className="h-5 w-5 text-primary" /><h2 className="font-display text-lg font-bold text-foreground">{title}</h2></div>
              <p className="mt-1 text-sm leading-6 text-foreground/60">{body}</p>
              <Link to={to} className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-primary transition-colors duration-150 ease-out hover:text-primary-hover">
                {action}<ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </article>
        ))}
      </section>

      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-[#9ac89c] bg-[#ecf8ed] p-5 text-sm text-[#24542b]">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
        <p><strong>Ready to go?</strong> Give one test stamp to your own shopper account, then scan a real customer card at the till.</p>
      </div>
    </OwnerLayout>
  )
}
