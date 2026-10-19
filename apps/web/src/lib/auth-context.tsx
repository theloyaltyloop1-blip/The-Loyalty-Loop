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
  const [rolesUserId, setRolesUserId] = React.useState<string | null>(null)
  const [refreshing, setRefreshing] = React.useState(false)
  const request = React.useRef(0)
  const userId = session?.user.id ?? null
  const rolesLoading = loading || refreshing || (userId !== null && rolesUserId !== userId)

  const refreshRoles = React.useCallback(async () => {
    if (!userId) return
    const id = ++request.current
    setRefreshing(true)
    try {
      const bootstrap = await supabase.rpc('ensure_current_user_bootstrap')
      if (bootstrap.error) throw bootstrap.error
      const { data, error } = await supabase.from('user_roles').select('role').eq('user_id', userId)
      if (error) throw error
      if (id === request.current) setRoles((data ?? []).map((r) => r.role as AppRole))
    } catch {
      if (id === request.current) setRoles([])
    } finally {
      if (id === request.current) { setRolesUserId(userId); setRefreshing(false) }
    }
  }, [userId])

  React.useEffect(() => {
    let active = true
    let authEvent = false
    void supabase.auth.getSession().then(({ data, error }) => {
      if (active && !authEvent) { setSession(error ? null : data.session); setLoading(false) }
    }).catch(() => { if (active && !authEvent) setLoading(false) })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      authEvent = true
      setSession(next)
      setLoading(false)
    })
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [])

  React.useEffect(() => {
    if (userId) void refreshRoles()
    else { request.current++; setRoles([]); setRolesUserId(null); setRefreshing(false) }
    return () => { request.current++ }
  }, [userId, refreshRoles])

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
