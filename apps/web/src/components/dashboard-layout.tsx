import * as React from 'react'
import { NavLink, Navigate, Link } from 'react-router-dom'
import { Home, Map, Megaphone, Gift, Heart, User, LogOut, Bell } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import loyaltyLoopLogo from '@/assets/loyalty-loop-mark.svg'
import { ThemeToggle } from '@/components/theme-toggle'
import { LegalFooterLinks } from '@/components/legal-footer'
import { BarePageSkeleton } from '@/components/page-skeleton'
import { AppCityBackground } from '@/components/app-city-background'
import '@/living.css'

const NAV_ITEMS = [
  { label: 'Home', to: '/dashboard', icon: Home, end: true },
  { label: 'Map', to: '/dashboard/discover', icon: Map },
  { label: 'News', to: '/dashboard/news', icon: Megaphone },
  { label: 'Rewards', to: '/dashboard/rewards', icon: Gift },
  { label: 'Favourites', to: '/dashboard/favourites', icon: Heart },
  { label: 'Profile', to: '/dashboard/profile', icon: User },
]

const navClass = ({ isActive }: { isActive: boolean }) =>
  'flex min-h-11 shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.97] ' +
  (isActive ? 'bg-peach text-peach-ink' : 'text-muted-foreground hover:bg-secondary hover:text-foreground')

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { signOut, primaryRole, rolesLoading, session } = useAuth()
  const host = React.useRef<HTMLDivElement>(null)
  // Signed-out visitors can browse the map; they get the map tab and a way in,
  // not personal tabs and a "Sign out" button.
  const navItems = session ? NAV_ITEMS : NAV_ITEMS.filter((item) => item.to === '/dashboard/discover')
  if (rolesLoading) return <BarePageSkeleton />
  if (primaryRole === 'admin') return <Navigate to="/access" replace />
  if (primaryRole === 'brand_head') return <Navigate to="/brand" replace />
  if (primaryRole === 'business_owner') return <Navigate to="/owner" replace />
  if (primaryRole === 'staff') return <Navigate to="/owner/scan" replace />

  return (
    <div className="lp-scene-host min-h-dvh bg-background" ref={host}>
      <AppCityBackground host={host} seed={3} />
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link to={session ? '/dashboard' : '/'} className="flex min-h-11 min-w-11 shrink-0 items-center gap-2.5" aria-label="The Loyalty Loop home">
            <img src={loyaltyLoopLogo} alt="" className="h-8 w-8 object-contain" />
            <span className="hidden font-display text-[17px] font-semibold tracking-tight sm:inline">The Loyalty Loop</span>
          </Link>
          <nav aria-label="Customer navigation" className="hidden flex-1 items-center justify-center gap-1 lg:flex">
            {navItems.map(({ label, to, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={navClass}>
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </nav>
          {session ? (<>
          <NavLink
            to="/dashboard/inbox"
            aria-label="Inbox"
            title="Inbox"
            className={({ isActive }) =>
              'ml-auto grid h-11 w-11 shrink-0 place-items-center rounded-full transition-[background-color,color,transform] duration-200 active:scale-[0.95] lg:ml-0 ' +
              (isActive ? 'bg-peach text-peach-ink' : 'text-muted-foreground hover:bg-secondary hover:text-foreground')
            }
          >
            <Bell className="h-5 w-5" aria-hidden="true" />
          </NavLink>
          <ThemeToggle compact />
          <button
            data-press-feedback
            onClick={signOut}
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" /> <span className="sr-only sm:not-sr-only">Sign out</span>
          </button>
          </>) : (<>
          <Link to="/login" className="ml-auto inline-flex min-h-11 items-center rounded-full px-3.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground lg:ml-0">Log in</Link>
          <Link to="/signup" className="inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover">Sign up</Link>
          <ThemeToggle compact />
          </>)}
        </div>
        <nav aria-label="Customer navigation" className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-3 sm:px-6 lg:hidden [scrollbar-width:none]">
          {navItems.map(({ label, to, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={navClass}>
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main id="main-content" tabIndex={-1} className="relative z-[2] mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 md:py-10">
        {children}
        <footer className="mt-16 border-t border-border pt-6 text-xs text-muted-foreground">
          <p className="mb-2">© {new Date().getFullYear()} The Loyalty Loop</p>
          <LegalFooterLinks />
        </footer>
      </main>
    </div>
  )
}
