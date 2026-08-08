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
  const [rolesLoading, setRolesLoading] = React.useState(true)

  const loadRoles = React.useCallback(async (userId: string) => {
    const { data, error } = await supabase.from('user_roles').select('role').eq('user_id', userId)
    if (!error && data) {
      const nextRoles = data.map((r) => r.role as AppRole)
      setRoles(nextRoles)
      if (nextRoles.includes('business_owner')) {
        void supabase.functions.invoke('send-owner-legal-documents')
      }
    }
  }, [])

  const refreshRoles = React.useCallback(async () => {
    if (!session?.user) return
    setRolesLoading(true)
    try {
      await supabase.rpc('ensure_current_user_bootstrap')
      await loadRoles(session.user.id)
    } finally {
      setRolesLoading(false)
    }
  }, [session, loadRoles])

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
    if (session?.user) {
      refreshRoles()
    } else {
      setRoles([])
      setRolesLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id])

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
