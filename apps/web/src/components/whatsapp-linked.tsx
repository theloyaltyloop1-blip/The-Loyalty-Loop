import * as React from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, MessageCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// After WhatsApp sign-up: open WhatsApp again with "START" ready to send,
// which replies with their rewards and card link. Falls back to buttons if
// the browser doesn't switch apps by itself.
export function WhatsAppLinked({ dashboardPath = '/dashboard' }: { dashboardPath?: string }) {
  const [url, setUrl] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    supabase.functions.invoke<{ url: string }>('whatsapp-handoff', { body: { action: 'start' } })
      .then(({ data }) => {
        if (cancelled || !data?.url) return
        setUrl(data.url)
        window.location.assign(data.url)
      })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [])

  return (
    <main className="grid min-h-dvh place-items-center bg-background p-6 text-center text-foreground">
      <section className="max-w-sm rounded-3xl bg-sage p-8 text-sage-ink">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-card text-primary"><CheckCircle2 className="h-6 w-6" /></span>
        <h1 className="mt-5 font-display text-3xl font-bold tracking-tight">You’re all set</h1>
        <p className="mt-3 text-sage-ink/80">Your WhatsApp is linked. Taking you back to WhatsApp — just tap send to see your rewards.</p>
        {url && <a href={url} className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"><MessageCircle className="h-4 w-4" />Open WhatsApp</a>}
        <Link to={dashboardPath} replace className="mt-4 block text-sm font-semibold text-sage-ink/80 underline-offset-4 hover:underline">Or open your Loyalty Loop account</Link>
      </section>
    </main>
  )
}
