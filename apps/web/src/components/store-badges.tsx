import { APPS } from '@/lib/store-links'

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
