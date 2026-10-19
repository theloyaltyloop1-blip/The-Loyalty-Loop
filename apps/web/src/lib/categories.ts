import { Coffee, Croissant, Scissors, ShoppingBag, Sparkles, Store, UtensilsCrossed } from 'lucide-react'
import type * as React from 'react'

export const CATEGORIES = ['Café', 'Restaurant', 'Barber', 'Salon', 'Bakery', 'Retail', 'Other'] as const

type CategoryCopy = {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  signupReward: string
  rewardTitle: string
  rewardDescription: string
  announcement: string
}

const COPY: Record<string, CategoryCopy> = {
  Café: { icon: Coffee, signupReward: 'Free coffee just for joining', rewardTitle: 'Free coffee', rewardDescription: 'Any size, any time', announcement: 'Our autumn drinks are here' },
  Restaurant: { icon: UtensilsCrossed, signupReward: 'Free dessert on your first visit', rewardTitle: 'Free main course', rewardDescription: 'Dine-in, any day', announcement: 'Our new seasonal menu is here' },
  Barber: { icon: Scissors, signupReward: '£5 off your first cut', rewardTitle: 'Free haircut', rewardDescription: 'Any standard cut', announcement: 'Late-night appointments now available' },
  Salon: { icon: Sparkles, signupReward: 'Free treatment upgrade on your first visit', rewardTitle: 'Free blow-dry', rewardDescription: 'Book with any stylist', announcement: 'New treatments now available' },
  Bakery: { icon: Croissant, signupReward: 'Free pastry just for joining', rewardTitle: 'Free loaf', rewardDescription: 'Any loaf from the counter', announcement: 'Fresh sourdough every morning' },
  Retail: { icon: ShoppingBag, signupReward: '10% off your first purchase', rewardTitle: '£10 off your next purchase', rewardDescription: 'On orders over £30', announcement: 'New stock just landed' },
}

const FALLBACK: CategoryCopy = { icon: Store, signupReward: 'A welcome treat just for joining', rewardTitle: 'Free reward', rewardDescription: 'Redeem on your next visit', announcement: 'Something new is coming' }

export function categoryCopy(category: string | null | undefined): CategoryCopy {
  return COPY[category ?? ''] ?? FALLBACK
}

/** Category options, keeping a legacy/custom stored value selectable instead of silently swapping it. */
export function categoryOptions(current?: string | null): string[] {
  return current && !(CATEGORIES as readonly string[]).includes(current) ? [...CATEGORIES, current] : [...CATEGORIES]
}
