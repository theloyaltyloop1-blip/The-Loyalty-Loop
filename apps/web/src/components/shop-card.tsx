import { useNavigate } from 'react-router-dom'
import { ArrowRight, BadgeCheck } from 'lucide-react'
import type { Business, Membership } from '@/lib/businesses'

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
    <button
      onClick={() => navigate(`/dashboard/shop/${business.slug}`)}
      className="text-left rounded-2xl bg-[#FBF6EC] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-5 relative hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition-shadow"
    >
      {joined && (
        <span className="absolute top-4 right-4 rounded-full bg-[#EFE1C8] text-[#5a4a30] text-[11px] font-bold uppercase tracking-wide px-3 py-1">
          Joined
        </span>
      )}

      <ShopLogo business={business} />

      <h3 className="font-display font-bold text-xl text-[#1a1a1a] mt-4 flex items-center gap-1.5">
        {business.name}
        {business.verification_status === 'verified' && (
          <BadgeCheck className="h-4 w-4 text-[#3B82C4] shrink-0" aria-label="Verified" />
        )}
      </h3>
      <p className="text-xs font-semibold uppercase tracking-wide text-[#1a1a1a]/50 mt-1 mb-4">
        {business.category}
      </p>

      <div className="border-t border-[#1a1a1a]/10 pt-3 flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold text-[#1a1a1a]/70">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: business.brand_color }} />
          {joined ? "You're a member" : 'Tap to join'}
        </span>
        <span className="flex items-center gap-1 text-sm font-bold text-[#C9622E]">
          View <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </button>
  )
}
