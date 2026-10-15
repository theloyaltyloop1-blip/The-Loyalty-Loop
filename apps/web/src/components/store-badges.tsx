// Official App Store and Google Play badges (artwork from Apple and Google, kept in
// /public/badges). An app's App Store badge shows as "coming soon" until its iosLive
// flag is switched on. Check first: https://itunes.apple.com/lookup?id=<id>&country=gb
// returns resultCount 1 once the app is public.
const APPS = {
  shopper: {
    play: 'https://play.google.com/store/apps/details?id=com.theloyaltyloop.shopper',
    ios: 'https://apps.apple.com/gb/app/id6809930346',
    iosLive: true,
    name: 'The Loyalty Loop',
  },
  business: {
    play: 'https://play.google.com/store/apps/details?id=com.theloyaltyloop.retailer',
    ios: 'https://apps.apple.com/gb/app/id6813259329',
    iosLive: false,
    name: 'The Loyalty Loop for Business',
  },
} as const

export function StoreBadges({ app = 'shopper', className = '' }: { app?: keyof typeof APPS; className?: string }) {
  const links = APPS[app]
  const badge = 'block h-11 w-auto transition-transform duration-200 ease-out'
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <a href={links.play} target="_blank" rel="noreferrer" className="rounded-[8px] hover:-translate-y-0.5 active:scale-[0.98] transition-transform duration-200">
        <img src="/badges/google-play.png" alt={`Get ${links.name} on Google Play`} className={badge} width={149} height={44} />
      </a>
      {links.iosLive ? (
        <a href={links.ios} target="_blank" rel="noreferrer" className="rounded-[8px] hover:-translate-y-0.5 active:scale-[0.98] transition-transform duration-200">
          <img src="/badges/app-store-black.svg" alt={`Download ${links.name} on the App Store`} className={badge} width={132} height={44} />
        </a>
      ) : (
        <span className="flex items-center gap-2" aria-label={`${links.name} is coming soon to the App Store`}>
          <img src="/badges/app-store-black.svg" alt="" aria-hidden="true" className={`${badge} opacity-45 grayscale`} width={132} height={44} />
          <span className="text-xs font-semibold text-muted-foreground">Coming soon</span>
        </span>
      )}
    </div>
  )
}
