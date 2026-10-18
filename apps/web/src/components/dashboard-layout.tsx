import * as React from 'react'
import { NavLink, Navigate } from 'react-router-dom'
import { Home, Megaphone, Gift, Heart, User, Shield, LogOut, History, Bell } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import loyaltyLoopLogo from '@/assets/loyalty-loop-logo.png'

const NAV_ITEMS = [
  { label: 'Home', to: '/dashboard', icon: Home, end: true },
  { label: 'News', to: '/dashboard/news', icon: Megaphone },
  { label: 'Rewards', to: '/dashboard/rewards', icon: Gift },
  { label: 'Activity', to: '/dashboard/activity', icon: History },
  { label: 'Inbox', to: '/dashboard/inbox', icon: Bell },
  { label: 'Favourites', to: '/dashboard/favourites', icon: Heart },
  { label: 'Profile', to: '/dashboard/profile', icon: User },
]

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { signOut, primaryRole, rolesLoading } = useAuth()
  if (rolesLoading) return null
  if (primaryRole === 'admin') return <Navigate to="/access" replace />
  if (primaryRole === 'brand_head') return <Navigate to="/brand" replace />
  if (primaryRole === 'business_owner') return <Navigate to="/owner" replace />
  if (primaryRole === 'staff') return <Navigate to="/owner/scan" replace />

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#F7ECDC]">
      <aside className="w-full md:w-64 shrink-0 border-b md:border-b-0 md:border-r border-black/5 flex flex-col p-3 md:p-5">
        <div className="flex items-center gap-2 px-2 mb-3 md:mb-8">
          <img src={loyaltyLoopLogo} alt="" className="h-8 w-8 object-contain rounded-full" />
          <span className="font-display font-extrabold text-lg text-[#1a1a1a]">The Loyalty Loop</span>
        </div>

        <nav className="flex flex-row md:flex-col gap-1 overflow-x-auto -mx-1 px-1 md:mx-0 md:px-0">
          {NAV_ITEMS.map(({ label, to, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                'flex shrink-0 items-center gap-3 rounded-2xl px-4 py-3 font-semibold whitespace-nowrap transition-colors ' +
                (isActive ? 'bg-[#C2410C] text-white' : 'text-[#1a1a1a]/80 hover:bg-black/5')
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}

        </nav>

        <div className="mt-2 md:mt-auto flex flex-row flex-wrap md:flex-col gap-1">
          <button
            onClick={signOut}
            className="flex items-center gap-3 rounded-2xl px-4 py-3 font-semibold text-[#1a1a1a]/75 hover:bg-black/5 transition-colors"
          >
            <LogOut className="h-5 w-5" />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 p-4 sm:p-6 md:p-8 max-w-5xl">{children}</main>

      <button
        title="Security"
        className="fixed bottom-4 right-4 md:bottom-6 md:right-6 h-12 w-12 md:h-14 md:w-14 rounded-full bg-[#3B2A1E] text-[#F6AF23] flex items-center justify-center shadow-lg hover:brightness-110 transition-all"
      >
        <Shield className="h-6 w-6" />
      </button>
    </div>
  )
}
