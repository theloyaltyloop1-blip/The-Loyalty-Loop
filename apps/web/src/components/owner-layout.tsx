import * as React from 'react'
import { NavLink, Link } from 'react-router-dom'
import { LineChart, Bell, Megaphone, Star, Settings, LogOut, ChevronDown, ArrowLeftRight } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useOwner } from '@/lib/owner-context'
import loyaltyLoopLogo from '@/assets/loyalty-loop-logo.png'

const NAV_ITEMS = [
  { label: 'Analytics', to: '/owner', icon: LineChart, end: true },
  { label: 'Notifications', to: '/owner/notifications', icon: Bell },
  { label: 'Announcements', to: '/owner/announcements', icon: Megaphone },
  { label: 'Reviews', to: '/owner/reviews', icon: Star },
  { label: 'Shop settings', to: '/owner/settings', icon: Settings },
]

function BusinessSwitcher() {
  const { businesses, business, setBusinessId } = useOwner()
  const [open, setOpen] = React.useState(false)

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

export function OwnerLayout({ children }: { children: React.ReactNode }) {
  const { signOut } = useAuth()

  return (
    <div className="min-h-screen flex bg-[#F7ECDC]">
      <aside className="w-64 shrink-0 border-r border-black/5 flex flex-col p-5">
        <div className="flex items-center gap-2 px-2 mb-6">
          <img src={loyaltyLoopLogo} alt="" className="h-8 w-8 object-contain rounded-full" />
          <span className="font-display font-extrabold text-lg text-[#1a1a1a]">The Loyalty Loop</span>
        </div>

        <BusinessSwitcher />

        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ label, to, icon: Icon, end }) => (
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
          <Link
            to="/dashboard"
            className="flex items-center gap-3 rounded-2xl px-4 py-3 font-semibold text-[#1a1a1a]/50 hover:bg-black/5 transition-colors"
          >
            <ArrowLeftRight className="h-5 w-5" />
            Switch to customer view
          </Link>
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
