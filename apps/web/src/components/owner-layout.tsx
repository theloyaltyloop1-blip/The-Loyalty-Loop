import * as React from 'react'
import { NavLink, Link, Navigate } from 'react-router-dom'
import { LineChart, Bell, Megaphone, Star, Settings, LogOut, ChevronDown, ArrowLeftRight, ScanLine, LifeBuoy, Wrench } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useOwner } from '@/lib/owner-context'
import loyaltyLoopLogo from '@/assets/loyalty-loop-logo.png'
import { LegalFooterLinks } from '@/components/legal-footer'

const OWNER_NAV_ITEMS = [
  { label: 'Analytics', to: '/owner', icon: LineChart, end: true },
  { label: 'Scan', to: '/owner/scan', icon: ScanLine },
  { label: 'Growth tools', to: '/owner/tools', icon: Wrench },
  { label: 'Notifications', to: '/owner/notifications', icon: Bell },
  { label: 'Announcements', to: '/owner/announcements', icon: Megaphone },
  { label: 'Reviews', to: '/owner/reviews', icon: Star },
  { label: 'Help & support', to: '/owner/support', icon: LifeBuoy },
  { label: 'Shop settings', to: '/owner/settings', icon: Settings },
]

// A staff-only account (no shop of their own) only ever needs the scan
// screen — Settings/Analytics/Announcements etc. are all owner-only pages
// server-side anyway, so there's nothing else for them to do here.
const STAFF_NAV_ITEMS = [{ label: 'Scan', to: '/owner/scan', icon: ScanLine, end: true }]

function BusinessSwitcher() {
  const { businesses, business, staffBusinesses, setBusinessId } = useOwner()
  const [open, setOpen] = React.useState(false)
  const [menuMounted, setMenuMounted] = React.useState(false)
  const closeTimer = React.useRef<number | null>(null)

  React.useEffect(() => () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current)
  }, [])

  function closeMenu() {
    setOpen(false)
    if (closeTimer.current) window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => setMenuMounted(false), 180)
  }

  function toggleMenu() {
    if (open) {
      closeMenu()
      return
    }
    if (closeTimer.current) window.clearTimeout(closeTimer.current)
    setMenuMounted(true)
    window.requestAnimationFrame(() => setOpen(true))
  }

  const isOwner = businesses.length > 0

  if (isOwner) {
    if (!business) return null
    return (
      <div className="relative mb-6">
        <button data-press-feedback
          onClick={toggleMenu}
          className="w-full flex items-center justify-between gap-2 rounded-2xl border border-black/10 bg-card px-4 py-3 font-semibold text-foreground transition-[transform,border-color] duration-150 ease-out active:scale-[0.98] hover:border-black/20"
        >
          <span className="flex items-center gap-2 truncate">
            <span
              className="h-6 w-6 rounded-md shrink-0 flex items-center justify-center text-white text-xs font-bold"
              style={{ backgroundColor: business.brand_color }}
            >
              {business.name.charAt(0).toUpperCase()}
            </span>
            <span className="truncate">{business.name}</span>
          </span>
          {businesses.length > 1 && (
            <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-150 ease-out ${open ? 'rotate-180' : ''}`} />
          )}
        </button>

        {menuMounted && businesses.length > 1 && (
          <div data-state={open ? 'open' : 'closed'} className="business-switcher-menu absolute z-50 mt-1 w-full rounded-2xl border border-black/10 bg-card shadow-lg overflow-hidden">
            {businesses.map((b) => (
              <button data-press-feedback
                key={b.id}
                onClick={() => {
                  setBusinessId(b.id)
                  closeMenu()
                }}
                className="w-full text-left px-4 py-2.5 font-medium text-foreground transition-colors duration-100 ease-out hover:bg-black/5"
              >
                {b.name}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (staffBusinesses.length > 0) {
    return (
      <div className="mb-6 rounded-2xl border border-black/10 bg-card px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-foreground/40 mb-1">Working at</p>
        <p className="font-semibold text-foreground truncate">
          {staffBusinesses.length === 1 ? staffBusinesses[0].business.name : `${staffBusinesses.length} shops`}
        </p>
      </div>
    )
  }

  return null
}

export function OwnerLayout({ children }: { children: React.ReactNode }) {
  const { signOut, primaryRole } = useAuth()
  const { businesses, staffBusinesses } = useOwner()
  const isOwner = businesses.length > 0
  const navItems = isOwner ? OWNER_NAV_ITEMS : STAFF_NAV_ITEMS
  if (!['admin', 'brand_head', 'business_owner', 'staff'].includes(primaryRole ?? '')) return <Navigate to="/dashboard" replace />

  return (
    <div className="min-h-screen bg-background md:flex">
      <aside className="border-b border-foreground/10 bg-card/80 backdrop-blur-xl p-3 md:flex md:w-64 md:shrink-0 md:flex-col md:border-b-0 md:border-r md:p-5">
        <div className="flex items-center gap-2 px-2 md:mb-6">
          <img src={loyaltyLoopLogo} alt="" className="h-8 w-8 object-contain rounded-full" />
          <span className="font-display text-base text-foreground">The Loyalty Loop</span>
        </div>

        <div className="mt-3 md:mt-0"><BusinessSwitcher /></div>

        <nav aria-label="Business navigation" className="flex gap-1 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:pb-0">
          {navItems.map(({ label, to, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                'flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-[transform,background-color,color] duration-150 ease-out active:scale-[0.97] md:gap-3 md:rounded-2xl md:px-4 md:py-3 md:text-base ' +
                (isActive ? 'bg-foreground text-white shadow-sm' : 'text-foreground/70 hover:bg-foreground/5')
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
          <button data-press-feedback onClick={signOut} className="flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-foreground/60 hover:bg-black/5 md:hidden">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </nav>

        <div className="mt-3 hidden md:mt-auto md:flex md:flex-col md:gap-1">
          {(isOwner || staffBusinesses.length === 0) && (
            <Link
              to="/dashboard"
              className="flex items-center gap-3 rounded-2xl px-4 py-3 font-semibold text-foreground/50 hover:bg-black/5 transition-colors duration-150 ease-out"
            >
              <ArrowLeftRight className="h-5 w-5" />
              Switch to customer view
            </Link>
          )}
          <button data-press-feedback
            onClick={signOut}
            className="flex items-center gap-3 rounded-2xl px-4 py-3 font-semibold text-foreground/50 hover:bg-black/5 transition-colors duration-150 ease-out"
          >
            <LogOut className="h-5 w-5" />
            Sign out
          </button>
        </div>
      </aside>

      <main className="w-full flex-1 p-4 sm:p-6 md:max-w-6xl md:p-10">
        {children}
        <footer className="mt-12 border-t border-black/10 pt-5 text-xs text-foreground/50">
          <div className="mb-2">© {new Date().getFullYear()} The Loyalty Loop</div>
          <LegalFooterLinks />
        </footer>
      </main>
    </div>
  )
}
