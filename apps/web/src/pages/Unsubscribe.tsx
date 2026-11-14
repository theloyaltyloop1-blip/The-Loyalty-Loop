import * as React from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { AuthLayout } from '@/components/auth-layout'

// Linked from the footer of release announcement emails. Unsubscribing needs a
// button press (a POST), so email link scanners opening the page do nothing.
export function Unsubscribe() {
  const [params] = useSearchParams()
  const u = params.get('u') ?? ''
  const t = params.get('t') ?? ''
  const [state, setState] = React.useState<'idle' | 'busy' | 'done' | 'error'>(u && t ? 'idle' : 'error')
  const [message, setMessage] = React.useState(u && t ? '' : 'This unsubscribe link is incomplete. Try opening it again from the email.')

  async function unsubscribe() {
    setState('busy')
    const { error } = await supabase.functions.invoke('product-updates-unsubscribe', { body: { u, t } })
    if (error) {
      setState('error')
      setMessage('We couldn’t unsubscribe you with this link. Please try again, or reply to the email and we’ll do it for you.')
      return
    }
    setState('done')
  }

  return (
    <AuthLayout title="Product news emails">
      {state === 'done' ? (
        <p className="rounded-xl bg-sage px-4 py-3 text-sage-ink">You’re unsubscribed. We won’t email you about new features any more. Your loyalty cards and any emails from shops you’ve joined aren’t affected.</p>
      ) : state === 'error' ? (
        <p className="text-destructive text-sm font-medium">{message}</p>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-muted-foreground">Stop getting emails from The Loyalty Loop about new features and updates? Your loyalty cards keep working as normal.</p>
          <Button size="lg" disabled={state === 'busy'} onClick={() => void unsubscribe()}>
            {state === 'busy' ? 'Unsubscribing…' : 'Unsubscribe'}
          </Button>
        </div>
      )}
    </AuthLayout>
  )
}
