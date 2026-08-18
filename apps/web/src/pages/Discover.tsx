import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, Share2, BadgeCheck } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { DashboardLayout } from '@/components/dashboard-layout'
import { usePageMeta } from '@/lib/use-page-meta'
import {
  fetchGalleryFeed,
  fetchFavouriteIds,
  addFavourite,
  removeFavourite,
  type GalleryFeedItem,
} from '@/lib/businesses'

function timeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks}w ago`
  return new Date(iso).toLocaleDateString()
}

function DiscoverCard({
  item,
  favourite,
  onToggleFavourite,
}: {
  item: GalleryFeedItem
  favourite: boolean
  onToggleFavourite: () => void
}) {
  const navigate = useNavigate()
  const { business } = item

  async function share() {
    const url = `${window.location.origin}/dashboard/shop/${business.slug}`
    if (navigator.share) {
      try {
        await navigator.share({ title: business.name, text: `Check out ${business.name} on The Loyalty Loop!`, url })
      } catch {
        // user cancelled — nothing to do
      }
      return
    }
    await navigator.clipboard.writeText(url)
  }

  return (
    <div className="relative h-full w-full snap-start shrink-0 overflow-hidden rounded-3xl bg-black">
      <img src={item.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />

      <div className="absolute right-4 bottom-28 flex flex-col items-center gap-6">
        <button
          data-press-feedback
          onClick={onToggleFavourite}
          className="flex flex-col items-center gap-1 text-white transition-transform duration-150 ease-out active:scale-90"
        >
          <Heart className={`h-7 w-7 ${favourite ? 'fill-primary text-primary' : 'text-white'}`} />
        </button>
        <button
          data-press-feedback
          onClick={share}
          className="flex flex-col items-center gap-1 text-white transition-transform duration-150 ease-out active:scale-90"
        >
          <Share2 className="h-6 w-6" />
        </button>
      </div>

      <button
        data-press-feedback
        onClick={() => navigate(`/dashboard/shop/${business.slug}`)}
        className="absolute bottom-6 left-5 right-24 text-left text-white"
      >
        <div className="flex items-center gap-2">
          {business.logo_url ? (
            <img src={business.logo_url} alt="" className="h-7 w-7 rounded-full border border-white/70 object-cover" />
          ) : (
            <span className="h-7 w-7 rounded-full border border-white/70" style={{ backgroundColor: business.brand_color }} />
          )}
          <span className="font-bold truncate">{business.name}</span>
          {business.verification_status === 'verified' && <BadgeCheck className="h-4 w-4 shrink-0 text-primary" />}
          <span className="text-xs text-white/70 shrink-0">· {timeAgo(item.created_at)}</span>
        </div>
        {business.description && <p className="mt-2 line-clamp-2 text-sm text-white/90">{business.description}</p>}
        <p className="mt-2 text-xs font-bold">View shop →</p>
      </button>
    </div>
  )
}

export function DiscoverPage() {
  const { session } = useAuth()
  const userId = session?.user.id
  const [items, setItems] = React.useState<GalleryFeedItem[]>([])
  const [favouriteIds, setFavouriteIds] = React.useState<Set<string>>(new Set())
  const [loading, setLoading] = React.useState(true)

  usePageMeta({
    title: 'Discover | The Loyalty Loop',
    description: 'Browse photos from local shops running loyalty cards near you.',
    path: '/dashboard/discover',
  })

  React.useEffect(() => {
    if (!userId) return
    Promise.all([fetchGalleryFeed(), fetchFavouriteIds(userId)])
      .then(([feed, favs]) => {
        setItems(feed)
        setFavouriteIds(favs)
      })
      .finally(() => setLoading(false))
  }, [userId])

  async function toggleFavourite(businessId: string) {
    if (!userId) return
    const isFav = favouriteIds.has(businessId)
    setFavouriteIds((prev) => {
      const next = new Set(prev)
      if (isFav) next.delete(businessId)
      else next.add(businessId)
      return next
    })
    try {
      if (isFav) await removeFavourite(userId, businessId)
      else await addFavourite(userId, businessId)
    } catch {
      setFavouriteIds((prev) => {
        const next = new Set(prev)
        if (isFav) next.add(businessId)
        else next.delete(businessId)
        return next
      })
    }
  }

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-2rem)] sm:h-[calc(100vh-3rem)] md:h-[calc(100vh-5rem)] -mx-4 sm:-mx-6 md:mx-0">
        {loading ? (
          <div className="flex h-full items-center justify-center text-foreground/50">Loading…</div>
        ) : items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center text-foreground/50">
            <p className="font-display text-xl font-bold text-foreground">No shop photos yet</p>
            <p>Check back soon as shops add photos to their gallery.</p>
          </div>
        ) : (
          <div className="h-full snap-y snap-mandatory overflow-y-scroll scroll-smooth" style={{ scrollbarWidth: 'none' }}>
            {items.map((item) => (
              <div key={item.id} className="h-full py-1 px-1 sm:px-0">
                <DiscoverCard
                  item={item}
                  favourite={favouriteIds.has(item.business.id)}
                  onToggleFavourite={() => toggleFavourite(item.business.id)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
