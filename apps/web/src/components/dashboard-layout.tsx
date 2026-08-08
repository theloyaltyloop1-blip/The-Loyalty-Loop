import * as React from 'react'
import { Link, NavLink, Navigate } from 'react-router-dom'
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
  const { signOut, primaryRole } = useAuth()
  if (primaryRole === 'admin') return <Navigate to="/access" replace />
  if (primaryRole === 'brand_head') return <Navigate to="/brand" replace />
  if (primaryRole === 'business_owner') return <Navigate to="/owner" replace />
  if (primaryRole === 'staff') return <Navigate to="/owner/scan" replace />

  return (
    <div className="min-h-screen flex bg-[#F7ECDC]">
      <aside className="w-64 shrink-0 border-r border-black/5 flex flex-col p-5">
        <div className="flex items-center gap-2 px-2 mb-8">
          <img src={loyaltyLoopLogo} alt="" className="h-8 w-8 object-contain rounded-full" />
          <span className="font-display font-extrabold text-lg text-[#1a1a1a]">The Loyalty Loop</span>
        </div>

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
          <button
            onClick={signOut}
            className="flex items-center gap-3 rounded-2xl px-4 py-3 font-semibold text-[#1a1a1a]/50 hover:bg-black/5 transition-colors"
          >
            <LogOut className="h-5 w-5" />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 max-w-5xl p-8">
        {children}
        <footer className="mt-12 border-t border-black/10 pt-5 text-xs text-[#1a1a1a]/50">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span>© {new Date().getFullYear()} The Loyalty Loop</span>
            <Link to="/privacy" className="font-semibold hover:text-[#1a1a1a] hover:underline">Privacy Notice</Link>
            <Link to="/terms" className="font-semibold hover:text-[#1a1a1a] hover:underline">Terms of Service</Link>
          </div>
        </footer>
      </main>

      <button
        title="Security"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-[#3B2A1E] text-[#F6AF23] flex items-center justify-center shadow-lg hover:brightness-110 transition-all"
      >
        <Shield className="h-6 w-6" />
      </button>
    </div>
  )
}
