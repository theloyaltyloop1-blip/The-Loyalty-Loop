import * as React from 'react'
import { useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import loyaltyLoopLogo from '@/assets/loyalty-loop-logo.png'

/** Sidebar shell: static on md+, an off-canvas drawer on phones that closes on Escape, backdrop tap or navigation. */
export function SidebarShell({ sidebar, children }: { sidebar: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const menuRef = React.useRef<HTMLButtonElement>(null)
  const closeRef = React.useRef<HTMLButtonElement>(null)
  const wasOpen = React.useRef(false)
  const { pathname } = useLocation()
  React.useEffect(() => setOpen(false), [pathname])
  React.useEffect(() => {
    if (!open) {
      if (wasOpen.current) menuRef.current?.focus()
      wasOpen.current = false
      return
    }
    wasOpen.current = true
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open])

  return (
    <div className="min-h-screen md:flex bg-[#F7ECDC]">
      <header className="md:hidden sticky top-0 z-30 flex items-center gap-2 border-b border-black/5 bg-[#F7ECDC] px-4 h-14">
        <button ref={menuRef} onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open} className="-ml-2 grid h-11 w-11 place-items-center rounded-full hover:bg-black/5">
          <Menu className="h-6 w-6" />
        </button>
        <img src={loyaltyLoopLogo} alt="" className="h-7 w-7 object-contain rounded-full" />
        <span className="font-display font-extrabold text-[#1a1a1a]">The Loyalty Loop</span>
      </header>
      {open && <div className="md:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setOpen(false)} aria-hidden="true" />}
      <aside
        role={open ? 'dialog' : undefined}
        aria-modal={open || undefined}
        aria-label="Navigation"
        className={'fixed inset-y-0 left-0 z-50 w-64 overflow-y-auto bg-[#F7ECDC] border-r border-black/5 flex flex-col p-5 transition-transform md:static md:z-auto md:translate-x-0 md:shrink-0 ' + (open ? 'translate-x-0' : '-translate-x-full invisible md:visible')}
      >
        <button ref={closeRef} onClick={() => setOpen(false)} aria-label="Close menu" className="md:hidden absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-full hover:bg-black/5">
          <X className="h-5 w-5" />
        </button>
        {sidebar}
      </aside>
      <main className="min-w-0 flex-1 p-4 sm:p-8 max-w-5xl">{children}</main>
    </div>
  )
}
