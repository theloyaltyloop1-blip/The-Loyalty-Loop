import { ArrowRight } from 'lucide-react'
import type { MockShop } from '@/lib/mock-shops'

/** Mock logo tile standing in for a real uploaded shop logo (businesses.logo_url, §3). */
function MockShopLogo() {
  return (
    <div className="h-14 w-14 shrink-0 rounded-lg border-2 border-[#1a1a1a] bg-[#FBF6EC] flex flex-col items-center justify-center gap-0.5 py-1">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="#1a1a1a">
        <path d="M12 2c3 0 4 2.5 2.2 5.2C13 9 12.4 10.2 12 12c-.4-1.8-1-3-2.2-4.8C8 4.5 9 2 12 2z" />
        <path d="M12 22c-3 0-4-2.5-2.2-5.2C10.8 15 11.6 13.8 12 12c.4 1.8 1 3 2.2 4.8C16 19.5 15 22 12 22z" />
      </svg>
      <span className="text-[7px] font-extrabold tracking-widest text-[#1a1a1a]">JOICE</span>
    </div>
  )
}

export function ShopCard({ name, category }: MockShop) {
  return (
    <div className="rounded-xl border-2 border-[#1a1a1a] bg-[#FBF6EC] p-4">
      <MockShopLogo />
      <h3 className="font-bold text-lg text-[#1a1a1a] mt-3">{name}</h3>
      <p className="text-xs text-[#1a1a1a]/50 font-semibold mb-4">{category}</p>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs text-[#1a1a1a]/60 font-semibold">
          <span className="h-2 w-2 rounded-full bg-[#C9622E]" /> Tap to join
        </span>
        <span className="flex items-center gap-1 text-sm font-bold text-[#C9622E]">
          View <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </div>
  )
}
