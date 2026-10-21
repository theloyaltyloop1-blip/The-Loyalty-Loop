import * as React from 'react'
import { NavLink, Link, Navigate, useLocation } from 'react-router-dom'
import { Users, Store, LogOut, ChevronDown, ArrowLeftRight, ScanLine } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useOwner } from '@/lib/owner-context'
import { onBrandColor } from '@/lib/utils'
import loyaltyLoopLogo from '@/assets/loyalty-loop-mark.png'
import { OwnerWalkthrough } from '@/components/owner-walkthrough'
import { LegalFooterLinks } from '@/components/legal-footer'
import { BarePageSkeleton } from '@/components/page-skeleton'
import { OwnerLoadError } from '@/components/owner-load-error'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

type NavItem = { label: string; to: string; icon: React.ComponentType<{ className?: string }>; end?: boolean; group?: string[] }

// Three tabs only. Customers and Shop are groups: the old pages still exist
// and appear as sub-tabs under their group (see SUB_TABS).
const CUSTOMERS_PATHS = ['/owner', '/owner/analytics', '/owner/announcements', '/owner/notifications']
const SHOP_PATHS = ['/owner/settings', '/owner/reviews', '/owner/support', '/owner/tools', '/owner/tutorial']

const OWNER_NAV_ITEMS: NavItem[] = [
  { label: 'Scan', to: '/owner/scan', icon: ScanLine },
  { label: 'Customers', to: '/owner/analytics', icon: Users, group: CUSTOMERS_PATHS },
  { label: 'Shop', to: '/owner/settings', icon: Store, group: SHOP_PATHS },
]

const SUB_TABS: Record<string, { label: string; to: string }[]> = {
  customers: [
    { label: 'Insights', to: '/owner/analytics' },
    { label: 'News posts', to: '/owner/announcements' },
    { label: 'Alerts', to: '/owner/notifications' },
  ],
  shop: [
    { label: 'Profile & rewards', to: '/owner/settings' },
    { label: 'Reviews', to: '/owner/reviews' },
    { label: 'Help', to: '/owner/support' },
    { label: 'More', to: '/owner/tools' },
  ],
}

function SubTabs({ pathname }: { pathname: string }) {
  const key = CUSTOMERS_PATHS.includes(pathname) ? 'customers' : SHOP_PATHS.includes(pathname) ? 'shop' : null
  if (!key) return null
  // The tutorial and growth tools are the "More" link; keep More highlighted there.
  const active = (to: string) => pathname === to || (to === '/owner/tools' && pathname === '/owner/tutorial')
  return (
    <nav aria-label="Section" className="mb-6 flex gap-1 overflow-x-auto">
      {SUB_TABS[key].map((t) => (
        <Link
          key={t.to}
          to={t.to}
          className={
            'shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ' +
            (active(t.to) ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-foreground/8')
          }
        >
          {t.label}
        </Link>
      ))}
    </nav>
  )
}

// A staff-only account (no shop of their own) only ever needs the scan
// screen. Settings/Analytics/Announcements etc. are all owner-only pages
// server-side anyway, so there's nothing else for them to do here.
const STAFF_NAV_ITEMS: NavItem[] = [{ label: 'Scan', to: '/owner/scan', icon: ScanLine, end: true }]

function BusinessSwitcher() {
  const { businesses, business, staffBusinesses, setBusinessId } = useOwner()
  const isOwner = businesses.length > 0

  if (isOwner) {
    if (!business) return null
    const trigger = (
      <button data-press-feedback
        className="w-full flex items-center justify-between gap-2 rounded-xl bg-olive-ink/10 px-3.5 py-3 font-semibold text-olive-ink transition-[transform,background-color] duration-200 ease-out active:scale-[0.98] hover:bg-olive-ink/15"
      >
        <span className="flex items-center gap-2 truncate">
          <span
            className="h-6 w-6 rounded-md shrink-0 flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: business.brand_color, color: onBrandColor(business.brand_color) }}
          >
            {business.name.charAt(0).toUpperCase()}
          </span>
          <span className="truncate">{business.name}</span>
        </span>
        {businesses.length > 1 && <ChevronDown className="h-4 w-4 shrink-0" />}
      </button>
    )
    if (businesses.length <= 1) return <div className="mb-6">{trigger}</div>
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild className="mb-6 block">{trigger}</DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-(--radix-dropdown-menu-trigger-width)">
          {businesses.map((b) => (
            <DropdownMenuItem key={b.id} onSelect={() => setBusinessId(b.id)} className="px-2.5 py-2">
              {b.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  if (staffBusinesses.length > 0) {
    return (
      <div className="mb-6 rounded-xl bg-olive-ink/10 px-3.5 py-3">
        <p className="text-xs text-olive-ink/70 mb-0.5">Working at</p>
        <p className="font-semibold text-olive-ink truncate">
          {staffBusinesses.length === 1 ? staffBusinesses[0].business.name : `${staffBusinesses.length} shops`}
        </p>
      </div>
    )
  }

  return null
}

export function OwnerLayout({ children }: { children: React.ReactNode }) {
  const { signOut, primaryRole, rolesLoading, roles } = useAuth()
  const { businesses, staffBusinesses, business, loading, loadError, needsRewardSetup } = useOwner()
  const { pathname } = useLocation()
  const isOwner = businesses.length > 0
  const navItems = isOwner ? OWNER_NAV_ITEMS : STAFF_NAV_ITEMS
  if (rolesLoading) return <BarePageSkeleton />
  if (!['admin', 'brand_head', 'business_owner', 'staff'].includes(primaryRole ?? '')) return <Navigate to="/dashboard" replace />
  if (!loading && loadError && businesses.length === 0 && staffBusinesses.length === 0) return <OwnerLoadError />
  // Setup is mandatory: an owner with no shop, or a shop with no reward yet,
  // can't reach any owner page until onboarding is finished.
  if (!loading && roles.includes('business_owner') && businesses.length === 0 && staffBusinesses.length === 0) {
    return <Navigate to="/owner/onboarding" replace />
  }
  if (!loading && business && needsRewardSetup) return <Navigate to="/owner/onboarding" replace />

  return (
    <div className="min-h-dvh bg-background md:flex">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <aside className="bg-olive text-olive-ink p-3 md:sticky md:top-0 md:flex md:h-dvh md:w-64 md:shrink-0 md:flex-col md:overflow-y-auto md:p-5">
        <div className="flex items-center gap-2 px-2 md:mb-6">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-olive-ink"><img src={loyaltyLoopLogo} alt="" className="h-7 w-7 object-contain" /></span>
          <span className="font-display text-[17px] font-semibold tracking-tight">The Loyalty Loop</span>
        </div>

        <div className="mt-3 md:mt-0"><BusinessSwitcher /></div>

        <nav aria-label="Business navigation" className="flex gap-1 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:pb-0">
          {navItems.map(({ label, to, icon: Icon, end, group }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive: routeActive }) => {
                const isActive = group ? group.includes(pathname) : routeActive
                return (
                'flex min-h-11 shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold transition-[transform,background-color,color] duration-200 ease-out active:scale-[0.97] md:gap-3 md:rounded-xl md:px-3.5 md:py-2.5 md:text-[15px] ' +
                (isActive ? 'bg-peach text-peach-ink' : 'text-olive-ink/75 hover:bg-olive-ink/10 hover:text-olive-ink')
                )
              }}
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
          <button data-press-feedback onClick={signOut} className="flex min-h-11 shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold text-olive-ink/70 hover:bg-olive-ink/10 md:hidden">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </nav>

        <div className="mt-3 hidden md:mt-auto md:flex md:flex-col md:gap-1">
          {(isOwner || staffBusinesses.length === 0) && (
            <Link
              to="/dashboard"
              className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[15px] font-semibold text-olive-ink/65 hover:bg-olive-ink/10 hover:text-olive-ink transition-colors duration-200 ease-out"
            >
              <ArrowLeftRight className="h-5 w-5" />
              Switch to customer view
            </Link>
          )}
          <button data-press-feedback
            onClick={signOut}
            className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[15px] font-semibold text-olive-ink/65 hover:bg-olive-ink/10 hover:text-olive-ink transition-colors duration-200 ease-out"
          >
            <LogOut className="h-5 w-5" />
            Sign out
          </button>
        </div>
      </aside>

      <main id="main-content" tabIndex={-1} className="w-full min-w-0 flex-1 px-4 py-6 sm:px-6 md:max-w-6xl md:px-10 md:py-10">
        {isOwner && business && <OwnerWalkthrough businessId={business.id} />}
        {isOwner && <SubTabs pathname={pathname} />}
        {children}
        <footer className="mt-16 border-t border-border pt-6 text-xs text-muted-foreground">
          <div className="mb-2">© {new Date().getFullYear()} The Loyalty Loop</div>
          <LegalFooterLinks />
        </footer>
      </main>
    </div>
  )
}
