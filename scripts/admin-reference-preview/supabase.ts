// All values are illustrative fixtures. This object performs no network requests.
const counts: Record<string, number> = { businesses: 124, memberships: 8420, transactions: 26384, rewards: 2196, announcements: 46, reviews: 381, support_requests: 2 }
const businesses = [{ id: 'shop-1', name: 'Marlow Street Coffee', slug: 'marlow-coffee', category: 'Coffee', brand_color: '#354D3D', trending: true, trending_position: 0, approval_status: 'approved', is_active: true }, { id: 'shop-2', name: 'Pip’s Bakehouse', slug: 'pips', category: 'Bakery', brand_color: '#B9471D', trending: false, trending_position: null, approval_status: 'approved', is_active: true }]
const usage = [
  { event_name: 'view_shop', surface: 'web', events: 864, people: 321, last_seen: '2026-10-09T10:00:00Z' },
  { event_name: 'scan_code', surface: 'retailer_android', events: 641, people: 73, last_seen: '2026-10-09T10:00:00Z' },
  { event_name: 'view_rewards', surface: 'shopper_ios', events: 482, people: 210, last_seen: '2026-10-09T10:00:00Z' },
  { event_name: 'join_shop', surface: 'shopper_android', events: 314, people: 155, last_seen: '2026-10-09T10:00:00Z' },
  { event_name: 'view_profile', surface: 'web', events: 226, people: 143, last_seen: '2026-10-09T10:00:00Z' },
  { event_name: 'redeem_reward', surface: 'retailer_ios', events: 168, people: 46, last_seen: '2026-10-09T10:00:00Z' },
]
function fixtureMode() { return new URLSearchParams(location.search).get('fixture') }
const failure = (message: string) => ({ data: null, error: { message } })
function from(table: string) {
  let head = false
  const chain: any = new Proxy({}, { get(_target, method) {
    if (method === 'then') return (resolve: any) => {
      if (fixtureMode() === 'queues-error' && table === 'support_requests') return resolve(failure('Fixture queue unavailable'))
      const data = table === 'businesses' ? businesses : table === 'support_requests' ? [{ id: 'support-1', status: 'open', subject: 'Help with my shop', body: 'A fixture support request.', business: { name: 'Marlow Street Coffee' }, created_at: '2026-10-09T10:00:00Z' }] : []
      return resolve({ data: head ? null : data, count: counts[table] ?? 0, error: null })
    }
    return (...args: any[]) => { if (method === 'select') head = Boolean(args[1]?.head); return chain }
  } })
  return chain
}
export const supabase = {
  from,
  rpc: async (name: string) => {
    if (name === 'admin_usage_analytics') {
      if (fixtureMode() === 'analytics-error') return failure('Fixture analytics unavailable')
      return { data: fixtureMode() === 'empty' ? [] : usage, error: null }
    }
    if (name === 'admin_pending_business_verifications') return { data: [{ id: 'pending-1', name: 'Corner Store', owner_email: 'owner@example.invalid' }], error: null }
    if (name === 'admin_set_role') return failure('Fixture role change rejected')
    if (name.startsWith('admin_list_') || name === 'admin_shop_requests') return { data: [], error: null }
    return { data: [], error: null }
  },
  functions: { invoke: async (name: string) => ({ data: name === 'platform-health' ? { checks: [{ label: 'Webhook endpoint', ok: true, detail: 'Illustrative healthy fixture' }] } : { details: [] }, error: null }) },
  storage: { from: () => ({ list: async () => ({ data: [], error: null }) }) },
  auth: { getSession: async () => ({ data: { session: null }, error: null }), getUser: async () => ({ data: { user: { id: 'fixture-admin' } }, error: null }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
}
