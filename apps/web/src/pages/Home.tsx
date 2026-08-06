import * as React from 'react'
import { Navigate } from 'react-router-dom'
import { Search, User } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { DashboardLayout } from '@/components/dashboard-layout'
import { SectionLabel } from '@/components/section-label'
import { ShopCard } from '@/components/shop-card'
import { TRENDING_SHOPS, NEARBY_SHOPS } from '@/lib/mock-shops'

export function Home() {
  const { session, loading } = useAuth()
  const [firstName, setFirstName] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!session?.user) return
    supabase
      .from('profiles')
      .select('first_name')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => setFirstName(data?.first_name ?? null))
  }, [session?.user])

  if (loading) return null
  if (!session) return <Navigate to="/login" replace />

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-[#1a1a1a]">
          Welcome to The Loyalty Loop{firstName ? ` – ${firstName}` : ''}
        </h1>
        <span className="h-10 w-10 rounded-full border-2 border-[#1a1a1a] flex items-center justify-center bg-white">
          <User className="h-5 w-5 text-[#1a1a1a]" />
        </span>
      </div>

      <div className="relative mb-8">
        <input
          placeholder="Search shops…"
          className="h-14 w-full rounded-xl border-2 border-[#1a1a1a] bg-[#FBF6EC] px-5 pr-14 font-semibold text-[#1a1a1a] placeholder:text-[#1a1a1a]/40 outline-none"
        />
        <Search className="absolute right-5 top-1/2 -translate-y-1/2 h-5 w-5 text-[#1a1a1a]" />
      </div>

      <div className="mb-6">
        <SectionLabel>Trending</SectionLabel>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
        {TRENDING_SHOPS.map((shop, i) => (
          <ShopCard key={i} {...shop} />
        ))}
      </div>

      <div className="mb-6">
        <SectionLabel>Nearby</SectionLabel>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {NEARBY_SHOPS.map((shop, i) => (
          <ShopCard key={i} {...shop} />
        ))}
      </div>
    </DashboardLayout>
  )
}
