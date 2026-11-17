import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ScanLine, UserPlus, Megaphone, Users, BarChart3, Star, Store, LifeBuoy, Gift } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'

type Command = { label: string; hint: string; to: string; icon: React.ComponentType<{ className?: string }>; group: 'Quick actions' | 'Go to' }

// Owner-only shortcuts. Every target is an existing owner route.
const COMMANDS: Command[] = [
  { label: 'Add a customer', hint: 'Scan their card and give a stamp', to: '/owner/scan', icon: UserPlus, group: 'Quick actions' },
  { label: 'Scan a customer', hint: 'Record a purchase or hand over a reward', to: '/owner/scan', icon: ScanLine, group: 'Quick actions' },
  { label: 'New offer', hint: 'Edit your rewards', to: '/owner/settings', icon: Gift, group: 'Quick actions' },
  { label: 'Message your customers', hint: 'Post a news update', to: '/owner/announcements', icon: Megaphone, group: 'Quick actions' },
  { label: 'Your customers', hint: 'Who is loyal, who has gone quiet', to: '/owner', icon: Users, group: 'Go to' },
  { label: 'Insights', hint: 'Numbers, summary and coach', to: '/owner/analytics', icon: BarChart3, group: 'Go to' },
  { label: 'Reviews', hint: 'What customers are saying', to: '/owner/reviews', icon: Star, group: 'Go to' },
  { label: 'Profile & rewards', hint: 'Shop details and programme', to: '/owner/settings', icon: Store, group: 'Go to' },
  { label: 'Help', hint: 'Support and guides', to: '/owner/support', icon: LifeBuoy, group: 'Go to' },
]

/** Compact search pill that opens the palette; also bound to Cmd/Ctrl-K. */
export function OwnerSearchPill({ className = '' }: { className?: string }) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [active, setActive] = React.useState(0)
  const navigate = useNavigate()

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const results = COMMANDS.filter((c) => (c.label + ' ' + c.hint).toLowerCase().includes(query.trim().toLowerCase()))
  const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform)

  function run(c: Command | undefined) {
    if (!c) return
    setOpen(false)
    navigate(c.to)
  }

  return (
    <>
      <button
        type="button"
        data-press-feedback
        onClick={() => { setQuery(''); setActive(0); setOpen(true) }}
        className={'inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card/80 px-3.5 text-sm text-muted-foreground transition-colors hover:text-foreground md:backdrop-blur-md ' + className}
        aria-label="Search and quick actions"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden rounded-md border border-border px-1.5 py-0.5 text-[11px] font-semibold md:inline">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-[20%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-lg md:bg-card/85 md:backdrop-blur-xl" showCloseButton={false}>
          <DialogTitle className="sr-only">Search and quick actions</DialogTitle>
          <DialogDescription className="sr-only">Type to find a page or action, then press Enter.</DialogDescription>
          <div className="flex items-center gap-2 border-b border-border px-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActive(0) }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)) }
                else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
                else if (e.key === 'Enter') { e.preventDefault(); run(results[active]) }
              }}
              placeholder="Type a page or action…"
              aria-label="Search"
              className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <ul role="listbox" className="max-h-80 overflow-y-auto p-2">
            {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">Nothing matches that.</li>}
            {results.map((c, i) => {
              const Icon = c.icon
              const showGroup = i === 0 || results[i - 1].group !== c.group
              return (
                <React.Fragment key={c.label}>
                  {showGroup && <li role="presentation" className="px-3 pb-1 pt-3 text-xs font-medium text-muted-foreground">{c.group}</li>}
                  <li role="option" aria-selected={i === active}>
                    <button
                      type="button"
                      onClick={() => run(c)}
                      onMouseEnter={() => setActive(i)}
                      className={'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ' + (i === active ? 'bg-foreground/8' : '')}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-foreground">{c.label}</span>
                        <span className="block truncate text-xs text-muted-foreground">{c.hint}</span>
                      </span>
                    </button>
                  </li>
                </React.Fragment>
              )
            })}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  )
}
