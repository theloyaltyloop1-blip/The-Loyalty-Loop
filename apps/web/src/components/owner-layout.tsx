import * as React from 'react'
import { NavLink, Link, Navigate } from 'react-router-dom'
import { LineChart, Bell, Megaphone, Star, Settings, LogOut, ChevronDown, ArrowLeftRight, ScanLine, LifeBuoy, Wrench } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useOwner } from '@/lib/owner-context'
import loyaltyLoopLogo from '@/assets/loyalty-loop-logo.png'

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

  const isOwner = businesses.length > 0

  if (isOwner) {
    if (!business) return null
    return (
      <div className="relative mb-6">
        <button
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-between gap-2 rounded-2xl border border-black/10 bg-[#FBF6EC] px-4 py-3 font-semibold text-[#1a1a1a]"
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
          {businesses.length > 1 && <ChevronDown className="h-4 w-4 shrink-0" />}
        </button>

        {open && businesses.length > 1 && (
          <div className="absolute z-10 mt-1 w-full rounded-2xl border border-black/10 bg-[#FBF6EC] shadow-lg overflow-hidden">
            {businesses.map((b) => (
              <button
                key={b.id}
                onClick={() => {
                  setBusinessId(b.id)
                  setOpen(false)
                }}
                className="w-full text-left px-4 py-2.5 font-medium text-[#1a1a1a] hover:bg-black/5"
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
      <div className="mb-6 rounded-2xl border border-black/10 bg-[#FBF6EC] px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-[#1a1a1a]/40 mb-1">Working at</p>
        <p className="font-semibold text-[#1a1a1a] truncate">
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
    <div className="min-h-screen flex bg-[#F7ECDC]">
      <aside className="w-64 shrink-0 border-r border-black/5 flex flex-col p-5">
        <div className="flex items-center gap-2 px-2 mb-6">
          <img src={loyaltyLoopLogo} alt="" className="h-8 w-8 object-contain rounded-full" />
          <span className="font-display font-extrabold text-lg text-[#1a1a1a]">The Loyalty Loop</span>
        </div>

        <BusinessSwitcher />

        <nav className="flex flex-col gap-1">
          {navItems.map(({ label, to, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                'flex items-center gap-3 rounded-2xl px-4 py-3 font-semibold transition-colors ' +
                (isActive ? 'bg-[#E8703B] text-white' : 'text-[#1a1a1a]/80 hover:bg-black/5')
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-1">
          {(isOwner || staffBusinesses.length === 0) && (
            <Link
              to="/dashboard"
              className="flex items-center gap-3 rounded-2xl px-4 py-3 font-semibold text-[#1a1a1a]/50 hover:bg-black/5 transition-colors"
            >
              <ArrowLeftRight className="h-5 w-5" />
              Switch to customer view
            </Link>
          )}
          <button
            onClick={signOut}
            className="flex items-center gap-3 rounded-2xl px-4 py-3 font-semibold text-[#1a1a1a]/50 hover:bg-black/5 transition-colors"
          >
            <LogOut className="h-5 w-5" />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 p-8 max-w-5xl">{children}</main>
    </div>
  )
}
