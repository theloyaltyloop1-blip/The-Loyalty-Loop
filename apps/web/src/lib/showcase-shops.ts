import { useQuery } from '@tanstack/react-query'
import { fetchBusinesses, type Business } from '@/lib/businesses'

/** Real shops already on The Loyalty Loop, for the example cards on the home page.
 *  Pending, rejected, inactive and test/demo shops are left out. Returns [] while
 *  loading or if the shop list cannot be read, and the page then shows neutral
 *  wording instead of inventing a shop. */
export function useShowcaseShops(limit = 3): Business[] {
  const { data } = useQuery({ queryKey: ['landing-showcase-shops'], queryFn: fetchBusinesses, staleTime: 5 * 60_000, retry: 0 })
  if (!data) return []
  return data
    .filter((b) => b.is_active && b.approval_status !== 'pending' && b.approval_status !== 'rejected' && !/test|demo/i.test(b.name))
    .slice(0, limit)
}
