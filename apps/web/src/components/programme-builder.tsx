import * as React from 'react'
import { ArrowUp, Info, Sparkles } from 'lucide-react'
import { describeRules, type ProgrammeRules } from '@loyalty-loop/loyalty/programme-rules'
import { designProgramme, type DesignMessage } from '@/lib/businesses'

const EXAMPLES = [
  '1 point for every £1, and 3 points = £1 off',
  'Every 6th haircut free, and double points on quiet Tuesdays',
  'Silver after 10 visits, Gold after 25 with 10% off, points expire after a year',
]

function moneyFor(symbol: string) {
  return (pence: number) => `${symbol}${symbol.length > 1 ? ' ' : ''}${(pence / 100).toFixed(pence % 100 === 0 ? 0 : 2)}`
}

/** The rules in plain English, the way customers will read them. */
export function RulesPreview({ rules, currencySymbol = '£', brandColor = '#2B3A67' }: {
  rules: ProgrammeRules; currencySymbol?: string; brandColor?: string
}) {
  const d = describeRules(rules, moneyFor(currencySymbol))
  const section = (title: string, lines: string[]) =>
    lines.length > 0 && (
      <div className="mt-3">
        <p className="text-[11px] font-bold tracking-wide text-white/75 mb-1">{title}</p>
        <ul className="space-y-1">
          {lines.map((line, i) => (
            <li key={i} className="text-sm font-semibold text-white leading-snug">{line}</li>
          ))}
        </ul>
      </div>
    )
  return (
    <div className="rounded-2xl p-4 shadow-sm" style={{ backgroundColor: brandColor }}>
      <p className="text-[11px] font-bold tracking-wide text-white/80">YOUR PROGRAMME</p>
      <p className="text-base font-display font-bold text-white mt-1">{rules.summary}</p>
      {section(`HOW TO EARN ${rules.unit.many.toUpperCase()}`, d.earn)}
      {section('WHAT THEY GET', d.spend)}
      {section('LEVELS', d.levels)}
      {d.small.length > 0 && <p className="text-xs text-white/75 mt-3">{d.small.join(' · ')}</p>}
    </div>
  )
}

/**
 * Chat with the AI programme builder. Calls onRules whenever the AI produces a
 * new, valid set of rules (they are only saved when the parent saves them).
 */
export function ProgrammeBuilder({
  shop, businessId, initialRules = null, onRules, brandColor,
}: {
  shop: { name?: string; category?: string; currencySymbol?: string }
  businessId?: string
  initialRules?: ProgrammeRules | null
  onRules: (rules: ProgrammeRules | null) => void
  brandColor?: string
}) {
  const [messages, setMessages] = React.useState<DesignMessage[]>([])
  const [rules, setRules] = React.useState<ProgrammeRules | null>(initialRules)
  const [notes, setNotes] = React.useState<{ request: string; closest: string }[]>([])
  const [input, setInput] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const listRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  async function send(text: string) {
    const content = text.trim()
    if (!content || busy) return
    const next: DesignMessage[] = [...messages, { role: 'user' as const, content }].slice(-24)
    setMessages(next)
    setInput('')
    setBusy(true)
    setError(null)
    try {
      const answer = await designProgramme({ messages: next, shop, businessId })
      setMessages([...next, { role: 'assistant', content: answer.reply }])
      if (answer.rules) {
        setRules(answer.rules)
        onRules(answer.rules)
      }
      if (answer.unsupported.length) setNotes(answer.unsupported)
    } catch (e) {
      setMessages(messages)
      setInput(content)
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div ref={listRef} className="max-h-[22rem] overflow-y-auto space-y-3 mb-3 pr-1" aria-live="polite">
        <div className="flex gap-2">
          <span className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="rounded-2xl rounded-tl-md bg-sage text-foreground px-4 py-3 text-sm leading-relaxed">
            {initialRules
              ? "Tell me what you'd like to change and I'll update your programme."
              : "Tell me how you'd like your loyalty programme to work, in your own words. I'll set it up and show you exactly what customers will see."}
          </div>
        </div>
        {messages.map((m, i) => (
          m.role === 'user' ? (
            <div key={i} className="flex justify-end">
              <div className="rounded-2xl rounded-tr-md bg-primary text-primary-foreground px-4 py-3 text-sm leading-relaxed max-w-[85%] whitespace-pre-wrap">{m.content}</div>
            </div>
          ) : (
            <div key={i} className="flex gap-2">
              <span className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                <Sparkles className="h-4 w-4" />
              </span>
              <div className="rounded-2xl rounded-tl-md bg-sage text-foreground px-4 py-3 text-sm leading-relaxed max-w-[85%] whitespace-pre-wrap">{m.content}</div>
            </div>
          )
        ))}
        {busy && (
          <div className="flex gap-2 items-center">
            <span className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 animate-pulse">
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="text-sm text-foreground/70">Working it out…</span>
          </div>
        )}
      </div>

      {messages.length === 0 && !initialRules && (
        <div className="flex flex-wrap gap-2 mb-3">
          {EXAMPLES.map((ex) => (
            <button
              data-press-feedback
              key={ex}
              type="button"
              onClick={() => void send(ex)}
              className="rounded-full border-2 border-border bg-white/60 px-3 py-1.5 text-xs font-semibold text-foreground text-left hover:border-primary"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); void send(input) }}
        className="flex items-end gap-2 rounded-2xl border-2 border-border bg-background p-2 focus-within:border-primary"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(input) } }}
          rows={2}
          maxLength={2000}
          placeholder={messages.length ? 'Reply or ask for a change…' : 'e.g. 3 points is £1 off, double points on Mondays'}
          className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground outline-none"
          aria-label="Describe your programme"
        />
        <button
          data-press-feedback
          type="submit"
          disabled={busy || !input.trim()}
          aria-label="Send"
          className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 shrink-0"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      </form>
      {error && <p className="text-sm text-destructive mt-2">{error}</p>}

      {rules && <div className="mt-5"><RulesPreview rules={rules} currencySymbol={shop.currencySymbol} brandColor={brandColor} /></div>}

      {notes.length > 0 && (
        <div className="mt-3 rounded-2xl bg-white/70 ring-1 ring-foreground/10 p-4">
          <p className="flex items-center gap-1.5 text-sm font-bold text-foreground mb-1">
            <Info className="h-4 w-4 text-primary" /> Not possible yet
          </p>
          <ul className="space-y-1.5">
            {notes.map((n, i) => (
              <li key={i} className="text-sm text-foreground/80">
                <span className="font-semibold text-foreground">{n.request}.</span>{n.closest ? ` Instead: ${n.closest}.` : ''}
              </li>
            ))}
          </ul>
          <p className="text-xs text-foreground/60 mt-2">We've passed this on to the team.</p>
        </div>
      )}
    </div>
  )
}
