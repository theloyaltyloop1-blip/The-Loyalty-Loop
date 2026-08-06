import * as React from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'
import loyaltyLoopLogo from '@/assets/loyalty-loop-logo.png'

const NAV_ITEMS = [
  { label: 'Home', to: '/dashboard' },
  { label: 'Map', to: '/dashboard/map' },
  { label: 'Rewards', to: '/dashboard/rewards' },
  { label: 'News', to: '/dashboard/news' },
]

function SidebarButton({
  children,
  active,
  onClick,
  to,
}: {
  children: React.ReactNode
  active?: boolean
  onClick?: () => void
  to?: string
}) {
  const className =
    'h-14 w-full rounded-xl border-2 border-[#1a1a1a] bg-white font-bold text-lg text-[#1a1a1a] flex items-center justify-center transition-colors hover:bg-[#1a1a1a] hover:text-white' +
    (active ? ' bg-[#1a1a1a] text-white' : '')

  if (to) {
    return (
      <NavLink to={to} end className={className}>
        {children}
      </NavLink>
    )
  }
  return (
    <button onClick={onClick} className={className}>
      {children}
    </button>
  )
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { signOut } = useAuth()

  return (
    <div className="min-h-screen flex bg-[#EADFC5]">
      <aside className="w-60 shrink-0 bg-[#F3E1BC] border-r-2 border-[#1a1a1a]/70 flex flex-col items-center p-6 gap-8">
        <img src={loyaltyLoopLogo} alt="The Loyalty Loop" className="w-full max-w-[180px] object-contain" />

        <nav className="w-full flex flex-col gap-4">
          {NAV_ITEMS.map((item) => (
            <SidebarButton key={item.to} to={item.to}>
              {item.label}
            </SidebarButton>
          ))}
          <SidebarButton onClick={signOut}>Sign Out</SidebarButton>
        </nav>
      </aside>

      <main className="flex-1 p-8">{children}</main>
    </div>
  )
}
