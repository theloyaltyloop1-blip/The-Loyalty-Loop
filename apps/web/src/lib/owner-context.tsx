import * as React from 'react'
import { useAuth } from './auth-context'
import { fetchOwnedBusinesses, fetchMyStaffBusinesses, type Business, type MyStaffMembership } from './businesses'

interface OwnerContextValue {
  businesses: Business[]
  business: Business | null
  staffBusinesses: MyStaffMembership[]
  setBusinessId: (id: string) => void
  loading: boolean
  refetch: () => Promise<void>
  updateLocalBusiness: (patch: Partial<Business>) => void
}

const OwnerContext = React.createContext<OwnerContextValue | undefined>(undefined)

const STORAGE_KEY = 'loyalty-loop:active-business-id'

export function OwnerProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth()
  const [businesses, setBusinesses] = React.useState<Business[]>([])
  const [staffBusinesses, setStaffBusinesses] = React.useState<MyStaffMembership[]>([])
  const [businessId, setBusinessIdState] = React.useState<string | null>(
    () => window.localStorage.getItem(STORAGE_KEY)
  )
  const [loading, setLoading] = React.useState(true)

  const userId = session?.user?.id

  const refetch = React.useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const [owned, staffOf] = await Promise.all([fetchOwnedBusinesses(userId), fetchMyStaffBusinesses(userId)])
      setBusinesses(owned)
      setStaffBusinesses(staffOf)
      setBusinessIdState((current) => {
        if (current && owned.some((b) => b.id === current)) return current
        return owned[0]?.id ?? null
      })
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  React.useEffect(() => {
    refetch()
  }, [refetch])

  const setBusinessId = React.useCallback((id: string) => {
    setBusinessIdState(id)
    window.localStorage.setItem(STORAGE_KEY, id)
  }, [])

  const updateLocalBusiness = React.useCallback((patch: Partial<Business>) => {
    setBusinesses((prev) => prev.map((b) => (b.id === businessId ? { ...b, ...patch } : b)))
  }, [businessId])

  const business = businesses.find((b) => b.id === businessId) ?? null

  return (
    <OwnerContext.Provider
      value={{ businesses, business, staffBusinesses, setBusinessId, loading, refetch, updateLocalBusiness }}
    >
      {children}
    </OwnerContext.Provider>
  )
}

export function useOwner() {
  const ctx = React.useContext(OwnerContext)
  if (!ctx) throw new Error('useOwner must be used within OwnerProvider')
  return ctx
}
