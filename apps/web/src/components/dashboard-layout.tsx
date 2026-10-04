import * as React from 'react'
import { NavLink, Navigate, Link } from 'react-router-dom'
import { Home, Map, Megaphone, Gift, Heart, User, LogOut, Bell } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import loyaltyLoopLogo from '@/assets/loyalty-loop-mark.png'
import { LegalFooterLinks } from '@/components/legal-footer'

const NAV_ITEMS = [
  { label: 'Home', to: '/dashboard', icon: Home, end: true },
  { label: 'Map', to: '/dashboard/discover', icon: Map },
  { label: 'News', to: '/dashboard/news', icon: Megaphone },
  { label: 'Rewards', to: '/dashboard/rewards', icon: Gift },
  { label: 'Favourites', to: '/dashboard/favourites', icon: Heart },
  { label: 'Profile', to: '/dashboard/profile', icon: User },
]

const navClass = ({ isActive }: { isActive: boolean }) =>
  'flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.97] ' +
  (isActive ? 'bg-peach text-peach-ink' : 'text-muted-foreground hover:bg-secondary hover:text-foreground')

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { signOut, primaryRole } = useAuth()
  if (primaryRole === 'admin') return <Navigate to="/access" replace />
  if (primaryRole === 'brand_head') return <Navigate to="/brand" replace />
  if (primaryRole === 'business_owner') return <Navigate to="/owner" replace />
  if (primaryRole === 'staff') return <Navigate to="/owner/scan" replace />

  return (
    <div className="min-h-dvh bg-background">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link to="/dashboard" className="flex shrink-0 items-center gap-2.5" aria-label="The Loyalty Loop home">
            <img src={loyaltyLoopLogo} alt="" className="h-8 w-8 object-contain" />
            <span className="hidden font-display text-[17px] font-semibold tracking-tight sm:inline">The Loyalty Loop</span>
          </Link>
          <nav aria-label="Customer navigation" className="hidden flex-1 items-center justify-center gap-1 lg:flex">
            {NAV_ITEMS.map(({ label, to, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={navClass}>
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </nav>
          <NavLink
            to="/dashboard/inbox"
            aria-label="Inbox"
            title="Inbox"
            className={({ isActive }) =>
              'ml-auto grid h-10 w-10 shrink-0 place-items-center rounded-full transition-[background-color,color,transform] duration-200 active:scale-[0.95] lg:ml-0 ' +
              (isActive ? 'bg-peach text-peach-ink' : 'text-muted-foreground hover:bg-secondary hover:text-foreground')
            }
          >
            <Bell className="h-5 w-5" aria-hidden="true" />
          </NavLink>
          <button
            data-press-feedback
            onClick={signOut}
            className="flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
          </button>
        </div>
        <nav aria-label="Customer navigation" className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-3 sm:px-6 lg:hidden [scrollbar-width:none]">
          {NAV_ITEMS.map(({ label, to, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={navClass}>
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 md:py-10">
        {children}
        <footer className="mt-16 border-t border-border pt-6 text-xs text-muted-foreground">
          <p className="mb-2">© {new Date().getFullYear()} The Loyalty Loop</p>
          <LegalFooterLinks />
        </footer>
      </main>
    </div>
  )
}
