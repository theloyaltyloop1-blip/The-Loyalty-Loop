import * as React from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Announcement = { id: string; title: string; body: string | null }

const DISMISSED_KEY = 'loyalty-loop-dismissed-announcements'

function readDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]')
  } catch {
    return []
  }
}

export function PlatformAnnouncementBanner() {
  const [items, setItems] = React.useState<Announcement[]>([])

  React.useEffect(() => {
    void supabase
      .from('platform_announcements')
      .select('id,title,body')
      .eq('is_active', true)
      .eq('target_website', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const dismissed = new Set(readDismissed())
        setItems(((data ?? []) as Announcement[]).filter((item) => !dismissed.has(item.id)))
      })
  }, [])

  function dismiss(id: string) {
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify([...readDismissed(), id]))
    } catch {
      // Best-effort only — if storage is unavailable the banner just reappears next visit.
    }
    setItems((current) => current.filter((item) => item.id !== id))
  }

  if (!items.length) return null

  return <div className="sticky top-0 z-[60] flex flex-col gap-1 bg-primary px-4 py-2 text-sm font-semibold text-white sm:px-6">
    {items.map((item) => (
      <div key={item.id} className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3">
        <p>{item.title}{item.body ? <span className="font-normal opacity-90"> — {item.body}</span> : null}</p>
        <button data-press-feedback type="button" onClick={() => dismiss(item.id)} aria-label="Dismiss announcement" className="shrink-0 rounded-full p-1 hover:bg-white/15">
          <X className="h-4 w-4" />
        </button>
      </div>
    ))}
  </div>
}
