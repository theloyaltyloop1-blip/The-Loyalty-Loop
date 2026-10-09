// Test-only alias. Never imported by the shipped app or production Vite config.
export function useAuth() {
  return { session: { user: { id: 'fixture-admin', email: 'preview@example.invalid' } }, roles: ['admin'], primaryRole: 'admin', loading: false, rolesLoading: false, signOut: async () => {}, refreshRoles: async () => {} }
}
