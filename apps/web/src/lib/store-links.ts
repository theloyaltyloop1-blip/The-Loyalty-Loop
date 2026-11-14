// Official App Store and Google Play badges (artwork from Apple and Google, kept in
// /public/badges). An app's App Store badge shows as "coming soon" until its iosLive
// flag is switched on. Check first: https://itunes.apple.com/lookup?id=<id>&country=gb
// returns resultCount 1 once the app is public.
export const APPS = {
  shopper: {
    play: 'https://play.google.com/store/apps/details?id=com.theloyaltyloop.shopper',
    ios: 'https://apps.apple.com/gb/app/id6809930346',
    iosLive: true,
    name: 'The Loyalty Loop',
  },
  business: {
    play: 'https://play.google.com/store/apps/details?id=com.theloyaltyloop.retailer',
    ios: 'https://apps.apple.com/gb/app/id6813259329',
    iosLive: true,
    name: 'The Loyalty Loop for Business',
  },
} as const
