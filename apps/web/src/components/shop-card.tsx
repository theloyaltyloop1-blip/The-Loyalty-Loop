import { useNavigate } from 'react-router-dom'
import { ArrowRight, BadgeCheck } from 'lucide-react'
import type { Business, Membership } from '@/lib/businesses'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

function ShopLogo({ business, size = 56 }: { business: Business; size?: number }) {
  if (business.logo_url) {
    return (
      <img
        src={business.logo_url}
        alt=""
        className="rounded-xl object-cover shrink-0 ring-1 ring-foreground/8"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <div
      className="rounded-xl flex items-center justify-center font-display font-bold text-white shrink-0"
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
      className="group flex w-full items-center gap-4 rounded-2xl bg-card p-4 text-left ring-1 ring-foreground/8 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgb(28_38_32/0.10)] sm:p-5"
    >
      <ShopLogo business={business} size={60} />

      <div className="min-w-0 flex-1">
        <h3 className="flex items-center gap-1.5 font-display text-lg font-semibold tracking-tight text-foreground">
          <span className="truncate">{business.name}</span>
          {business.verification_status === 'verified' && (
            // Not focusable: the whole card is already one button, so this stays a
            // hover-only hint for mouse users rather than a second, nested tab stop.
            <Tooltip>
              <TooltipTrigger asChild>
                <BadgeCheck className="h-4 w-4 shrink-0 text-fun-green" aria-label="Verified: we've confirmed this is a real business" />
              </TooltipTrigger>
              <TooltipContent>Verified: we've confirmed this is a real business</TooltipContent>
            </Tooltip>
          )}
        </h3>
        <p className="mt-0.5 text-sm text-muted-foreground">{business.category}</p>
        <span className={'mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ' + (joined ? 'bg-sage text-sage-ink' : 'bg-peach text-peach-ink')}>
          {joined ? "You're a member" : 'Tap to join'}
        </span>
      </div>

      <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1 group-hover:text-foreground" aria-hidden="true" />
    </button>
  )
}
