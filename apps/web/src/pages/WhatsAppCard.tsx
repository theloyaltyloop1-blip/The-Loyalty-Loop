import * as React from 'react'
import { ExternalLink, MessageCircle } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

type CardData = {
  kind: 'card'
  customerCode: string
  manualCode: string | null
  firstName: string
  appUrl: string
  memberships: Array<{ stamp_count: number; points_balance: number; visit_count: number; reward_progress_pence?: number | null; business: { name: string; loyalty_type: 'stamp_card' | 'points' | 'tiered'; reward_model?: 'stamp_legacy' | 'spend_threshold' } | null }>
}

export function WhatsAppCard() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [card, setCard] = React.useState<CardData | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (token.length < 32) return setError('This QR link is invalid. Return to WhatsApp and send START again.')
    supabase.functions.invoke<CardData>('whatsapp-handoff', { body: { action: 'card', token } })
      .then(({ data, error: requestError }) => {
        if (requestError || !data) throw requestError ?? new Error('This QR link has expired.')
        setCard(data)
      })
      .catch((requestError: unknown) => setError(requestError instanceof Error ? requestError.message : 'We could not load your QR card.'))
  }, [token])

  return <main className="min-h-dvh bg-background px-5 py-10 text-foreground sm:px-8"><section className="mx-auto max-w-md rounded-3xl bg-card p-6 text-center ring-1 ring-foreground/8 sm:p-8"><div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-peach text-peach-ink"><MessageCircle className="h-5 w-5" /></div>{error ? <><h1 className="mt-5 font-display text-3xl font-bold tracking-tight">QR link expired</h1><p className="mt-3 text-muted-foreground">{error}</p></> : !card ? <><h1 className="mt-5 font-display text-3xl font-bold tracking-tight">Loading your card</h1><p className="mt-3 text-muted-foreground">Preparing your customer QR code…</p></> : <><p className="mt-5 text-sm font-semibold text-muted-foreground">The Loyalty Loop</p><h1 className="mt-2 font-display text-3xl font-bold tracking-tight">Hi, {card.firstName}</h1><p className="mt-2 text-muted-foreground">Show this QR code to any participating shop.</p><div className="mx-auto mt-6 inline-block rounded-3xl bg-card p-4 shadow-inner"><QRCodeSVG value={card.customerCode} size={210} level="H" includeMargin /></div>{card.manualCode && <><p className="mt-5 text-xs font-bold tracking-[.15em] text-muted-foreground">Manual code</p><p className="mt-1 font-mono text-2xl font-bold tracking-[.18em]">{card.manualCode}</p></>}<div className="mt-7 space-y-2 text-left">{card.memberships.map((membership, index) => { const biz = membership.business; const unit = biz?.reward_model === 'spend_threshold' ? `£${(Math.max(0, membership.reward_progress_pence ?? 0) / 100).toFixed(2)} towards your next reward` : biz?.loyalty_type === 'points' ? `${membership.points_balance} points` : biz?.loyalty_type === 'tiered' ? `${membership.visit_count} visits` : `${membership.stamp_count} stamps`; return <div key={`${membership.business?.name ?? 'shop'}-${index}`} className="flex items-center justify-between rounded-xl bg-black/[.035] px-4 py-3 text-sm"><span className="font-bold">{membership.business?.name ?? 'Local shop'}</span><span className="text-muted-foreground">{unit}</span></div> })}</div><a href={card.appUrl} className="mt-7 flex h-12 items-center justify-center gap-2 rounded-full bg-foreground font-bold text-background">Open The Loyalty Loop <ExternalLink className="h-4 w-4" /></a></>}</section></main>
}
