import * as React from 'react'
import { MessageCircle } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export function WhatsAppStart() {
  const [params] = useSearchParams()
  const [error, setError] = React.useState<string | null>(null)
  const shop = params.get('shop') ?? ''

  React.useEffect(() => {
    supabase.functions.invoke<{ url: string }>('whatsapp-handoff', { body: { action: 'start', shop } })
      .then(({ data, error: requestError }) => {
        if (requestError || !data?.url) throw requestError ?? new Error('This QR code is unavailable.')
        window.location.assign(data.url)
      })
      .catch((requestError: unknown) => setError(requestError instanceof Error ? requestError.message : 'This QR code is unavailable.'))
  }, [shop])

  return <main className="grid min-h-screen place-items-center bg-background p-6 text-center text-foreground"><section className="max-w-sm rounded-3xl bg-card p-8 shadow-sm"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary"><MessageCircle className="h-6 w-6" /></span><h1 className="mt-5 font-display text-3xl font-extrabold">Opening WhatsApp</h1><p className="mt-3 text-foreground/65">{error ?? 'Starting your Loyalty Loop journey…'}</p>{error && <a href="/" className="mt-5 inline-block font-bold text-primary">Back to The Loyalty Loop</a>}</section></main>
}
