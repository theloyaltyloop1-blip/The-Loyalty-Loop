import * as React from 'react'
import { Navigate } from 'react-router-dom'
import { Search, User, Store, ArrowRight } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { DashboardLayout } from '@/components/dashboard-layout'

// Placeholder shop data — will be replaced by real `businesses` rows once
// browse/discover (§2) is built.
const TRENDING_SHOPS = [
  { name: 'Joice Cafe', category: 'CAFE' },
  { name: 'Joice Cafe', category: 'CAFE' },
  { name: 'Joice Cafe', category: 'CAFE' },
]

const NEARBY_SHOPS = [
  { name: 'Joice Cafe', category: 'CAFE' },
  { name: 'Joice Cafe', category: 'CAFE' },
  { name: 'Joice Cafe', category: 'CAFE' },
]

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded-md border-2 border-[#2f6b3a] px-3 py-1 text-sm font-extrabold uppercase tracking-wide text-[#2f6b3a]">
      {children}
    </span>
  )
}

function ShopCard({ name, category }: { name: string; category: string }) {
  return (
    <div className="rounded-xl border-2 border-[#1a1a1a] bg-[#FBF6EC] p-4">
      <div className="h-14 w-14 rounded-full border-2 border-[#1a1a1a] bg-white flex items-center justify-center mb-3">
        <Store className="h-6 w-6 text-[#1a1a1a]" />
      </div>
      <h3 className="font-bold text-lg text-[#1a1a1a]">{name}</h3>
      <p className="text-xs text-[#1a1a1a]/50 font-semibold mb-4">{category}</p>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs text-[#1a1a1a]/60 font-semibold">
          <span className="h-2 w-2 rounded-full bg-[#C9622E]" /> Tap to join
        </span>
        <span className="flex items-center gap-1 text-sm font-bold text-[#C9622E]">
          View <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </div>
  )
}

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
