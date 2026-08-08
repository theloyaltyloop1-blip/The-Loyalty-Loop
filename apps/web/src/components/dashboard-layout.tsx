import * as React from 'react'
import { NavLink, Navigate } from 'react-router-dom'
import { Home, Megaphone, Gift, Heart, User, Shield, LogOut, History, Bell } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import loyaltyLoopLogo from '@/assets/loyalty-loop-logo.png'
import { LegalFooterLinks } from '@/components/legal-footer'

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
    <div className="min-h-screen bg-[#F7ECDC] md:flex">
      <aside className="border-b border-black/5 bg-[#F7ECDC] p-3 md:flex md:w-64 md:shrink-0 md:flex-col md:border-b-0 md:border-r md:p-5">
        <div className="flex items-center gap-2 px-2 md:mb-8">
          <img src={loyaltyLoopLogo} alt="" className="h-8 w-8 object-contain rounded-full" />
          <span className="font-display font-extrabold text-lg text-[#1a1a1a]">The Loyalty Loop</span>
        </div>

        <nav aria-label="Customer navigation" className="mt-3 flex gap-1 overflow-x-auto pb-1 md:mt-0 md:flex-col md:overflow-visible md:pb-0">
          {NAV_ITEMS.map(({ label, to, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                'flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors md:gap-3 md:rounded-2xl md:px-4 md:py-3 md:text-base ' +
                (isActive ? 'bg-[#E8703B] text-white' : 'text-[#1a1a1a]/80 hover:bg-black/5')
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
          <button onClick={signOut} className="flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-[#1a1a1a]/60 hover:bg-black/5 md:hidden">
            <LogOut className="h-4 w-4" /> Sign out
          </button>

        </nav>

        <div className="mt-3 hidden md:mt-auto md:flex md:flex-col md:gap-1">
          <button
            onClick={signOut}
            className="flex items-center gap-3 rounded-2xl px-4 py-3 font-semibold text-[#1a1a1a]/50 hover:bg-black/5 transition-colors"
          >
            <LogOut className="h-5 w-5" />
            Sign out
          </button>
        </div>
      </aside>

      <main className="w-full flex-1 p-4 sm:p-6 md:max-w-5xl md:p-8">
        {children}
        <footer className="mt-12 border-t border-black/10 pt-5 text-xs text-[#1a1a1a]/50">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-2">
            <span>© {new Date().getFullYear()} The Loyalty Loop</span>
          </div>
          <LegalFooterLinks />
        </footer>
      </main>

      <button
        title="Security"
        className="fixed bottom-4 right-4 h-12 w-12 rounded-full bg-[#3B2A1E] text-[#F6AF23] flex items-center justify-center shadow-lg hover:brightness-110 transition-all md:bottom-6 md:right-6 md:h-14 md:w-14"
      >
        <Shield className="h-6 w-6" />
      </button>
    </div>
  )
}
