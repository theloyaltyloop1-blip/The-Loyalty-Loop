import * as React from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

export type AppRole = 'admin' | 'brand_head' | 'business_owner' | 'staff' | 'consumer'

const ROLE_PRIORITY: AppRole[] = ['admin', 'brand_head', 'business_owner', 'staff', 'consumer']

interface AuthContextValue {
  session: Session | null
  roles: AppRole[]
  primaryRole: AppRole | null
  loading: boolean
  rolesLoading: boolean
  refreshRoles: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null)
  const [roles, setRoles] = React.useState<AppRole[]>([])
  const [loading, setLoading] = React.useState(true)
  // Roles are "loading" until they have been fetched for the current user id. Deriving this
  // (rather than toggling a flag in an effect) closes the window where a fresh session
  // rendered with no roles and role-gated layouts redirected owners away.
  const [rolesUserId, setRolesUserId] = React.useState<string | null>(null)
  const [refreshing, setRefreshing] = React.useState(false)
  const rolesRequestRef = React.useRef(0)
  const userId = session?.user?.id ?? null
  const rolesLoading = loading || refreshing || (userId !== null && rolesUserId !== userId)

  const loadRoles = React.useCallback(async (uid: string) => {
    const { data, error } = await supabase.from('user_roles').select('role').eq('user_id', uid)
    if (!error && data) {
      setRoles(data.map((r) => r.role as AppRole))
    }
  }, [])

  const refreshRoles = React.useCallback(async () => {
    if (!userId) return
    const req = ++rolesRequestRef.current
    setRefreshing(true)
    try {
      await supabase.rpc('ensure_current_user_bootstrap')
      await loadRoles(userId)
    } finally {
      if (req === rolesRequestRef.current) {
        setRolesUserId(userId)
        setRefreshing(false)
      }
    }
  }, [userId, loadRoles])

  React.useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  React.useEffect(() => {
    if (userId) {
      refreshRoles()
    } else {
      rolesRequestRef.current++
      setRoles([])
      setRolesUserId(null)
      setRefreshing(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const signOut = React.useCallback(async () => {
    await supabase.auth.signOut()
    window.localStorage.clear()
    setRoles([])
  }, [])

  const primaryRole = ROLE_PRIORITY.find((r) => roles.includes(r)) ?? null

  const value = React.useMemo(
    () => ({ session, roles, primaryRole, loading, rolesLoading, refreshRoles, signOut }),
    [session, roles, primaryRole, loading, rolesLoading, refreshRoles, signOut]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
