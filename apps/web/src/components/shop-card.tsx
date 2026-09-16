import { useNavigate } from 'react-router-dom'
import { ArrowRight, BadgeCheck } from 'lucide-react'
import type { Business, Membership } from '@/lib/businesses'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'

function ShopLogo({ business, size = 56 }: { business: Business; size?: number }) {
  if (business.logo_url) {
    return (
      <img
        src={business.logo_url}
        alt=""
        className="rounded-xl border border-black/10 object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <div
      className="rounded-xl border border-black/10 flex items-center justify-center font-display font-extrabold text-white shrink-0"
      style={{ width: size, height: size, backgroundColor: business.brand_color, fontSize: size * 0.4 }}
    >
      {business.name.charAt(0).toUpperCase()}
    </div>
  )
}

export function ShopCard({ business, membership }: { business: Business; membership?: Membership | null }) {
  const navigate = useNavigate()
  const joined = Boolean(membership)

  return (
    <button data-press-feedback
      onClick={() => navigate(`/dashboard/shop/${business.slug}`)}
      className="w-full text-left rounded-2xl bg-card shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-5 relative hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition-shadow duration-150 ease-out"
    >
      {joined && (
        <Badge variant="secondary" className="absolute top-4 right-4 uppercase tracking-wide">
          Joined
        </Badge>
      )}

      <ShopLogo business={business} />

      <h3 className="font-display font-bold text-xl text-foreground mt-4 flex items-center gap-1.5">
        {business.name}
        {business.verification_status === 'verified' && (
          // Not focusable: the whole card is already one button, so this stays a
          // hover-only hint for mouse users rather than a second, nested tab stop.
          <Tooltip>
            <TooltipTrigger asChild>
              <BadgeCheck className="h-4 w-4 text-[#3B82C4] shrink-0" aria-label="Verified — we've confirmed this is a real business" />
            </TooltipTrigger>
            <TooltipContent>Verified — we've confirmed this is a real business</TooltipContent>
          </Tooltip>
        )}
      </h3>
      <p className="text-xs font-semibold uppercase tracking-wide text-foreground/50 mt-1 mb-4">
        {business.category}
      </p>

      <div className="border-t border-foreground/10 pt-3 flex min-w-0 items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground/70">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: business.brand_color }} />
          <span className="truncate">{joined ? "You're a member" : 'Tap to join'}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-sm font-bold text-primary-hover">
          View <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </button>
  )
}
