import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/lib/auth-context'
import { OwnerProvider } from '@/lib/owner-context'
import { Landing } from '@/pages/Landing'
import { CookieConsent } from '@/components/cookie-consent'
import { BarePageSkeleton } from '@/components/page-skeleton'
import { UsageTracker } from '@/components/usage-tracker'
import { ThemeProvider } from '@/components/theme-toggle'
import { ThemeToggle } from '@/components/theme-toggle'
import { usePageMeta } from '@/lib/use-page-meta'

// Owner/admin-only screens are rarely hit by a typical customer visit, so
// they're code-split out of the main bundle rather than shipped upfront.
const OwnerAnalytics = lazy(() => import('@/pages/owner/Analytics').then((m) => ({ default: m.OwnerAnalytics })))
const OwnerOnboarding = lazy(() => import('@/pages/owner/Onboarding').then((m) => ({ default: m.OwnerOnboarding })))
const OwnerScan = lazy(() => import('@/pages/owner/Scan').then((m) => ({ default: m.OwnerScan })))
const OwnerSettings = lazy(() => import('@/pages/owner/Settings').then((m) => ({ default: m.OwnerSettings })))
const OwnerAnnouncements = lazy(() => import('@/pages/owner/Announcements').then((m) => ({ default: m.OwnerAnnouncements })))
const OwnerReviews = lazy(() => import('@/pages/owner/Reviews').then((m) => ({ default: m.OwnerReviews })))
const OwnerSupport = lazy(() => import('@/pages/owner/Support').then((m) => ({ default: m.OwnerSupport })))
const OwnerTools = lazy(() => import('@/pages/owner/Tools').then((m) => ({ default: m.OwnerTools })))
const OwnerTutorial = lazy(() => import('@/pages/owner/Tutorial').then((m) => ({ default: m.OwnerTutorial })))
const OwnerNotifications = lazy(() => import('@/pages/owner/Notifications').then((m) => ({ default: m.OwnerNotifications })))
const Home = lazy(() => import('@/pages/Home').then((m) => ({ default: m.Home })))
const DiscoverPage = lazy(() => import('@/pages/Discover').then((m) => ({ default: m.DiscoverPage })))
const ShopDetail = lazy(() => import('@/pages/ShopDetail').then((m) => ({ default: m.ShopDetail })))
const RewardsPage = lazy(() => import('@/pages/Rewards').then((m) => ({ default: m.RewardsPage })))
const NewsPage = lazy(() => import('@/pages/News').then((m) => ({ default: m.NewsPage })))
const FavouritesPage = lazy(() => import('@/pages/Favourites').then((m) => ({ default: m.FavouritesPage })))
const ProfilePage = lazy(() => import('@/pages/Profile').then((m) => ({ default: m.ProfilePage })))
const Login = lazy(() => import('@/pages/Login').then((m) => ({ default: m.Login })))
const Signup = lazy(() => import('@/pages/Signup').then((m) => ({ default: m.Signup })))
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword').then((m) => ({ default: m.ForgotPassword })))
const ResetPassword = lazy(() => import('@/pages/ResetPassword').then((m) => ({ default: m.ResetPassword })))
const ActivityPage = lazy(() => import('@/pages/Activity').then((m) => ({ default: m.ActivityPage })))
const InboxPage = lazy(() => import('@/pages/Inbox').then((m) => ({ default: m.InboxPage })))
const AuthCallback = lazy(() => import('@/pages/AuthCallback').then((m) => ({ default: m.AuthCallback })))
const NotFound = lazy(() => import('@/pages/NotFound').then((m) => ({ default: m.NotFound })))
const AccessPanel = lazy(() => import('@/pages/AccessPanel').then((m) => ({ default: m.AccessPanel })))
const BrandWorkspace = lazy(() => import('@/pages/BrandWorkspace').then((m) => ({ default: m.BrandWorkspace })))
const WhatsAppOnboarding = lazy(() => import('@/pages/WhatsAppOnboarding').then((m) => ({ default: m.WhatsAppOnboarding })))
const WhatsAppCard = lazy(() => import('@/pages/WhatsAppCard').then((m) => ({ default: m.WhatsAppCard })))
const WhatsAppStart = lazy(() => import('@/pages/WhatsAppStart').then((m) => ({ default: m.WhatsAppStart })))

const queryClient = new QueryClient()

function RouteMeta() {
  const { pathname } = useLocation()
  const privatePage = pathname.startsWith('/dashboard') || pathname.startsWith('/owner') || pathname.startsWith('/access') || pathname.startsWith('/brand') || pathname.startsWith('/whatsapp') || pathname.startsWith('/auth') || pathname.startsWith('/reset-password')
  const labels: Record<string, { title: string; description: string }> = {
    '/login': { title: 'Log in | The Loyalty Loop', description: 'Log in to your Loyalty Loop account.' },
    '/signup': { title: 'Join The Loyalty Loop', description: 'Create a free Loyalty Loop account and start collecting local rewards.' },
    '/signup/owner': { title: 'Bring your shop to The Loyalty Loop', description: 'Create a digital loyalty card for your independent business.' },
    '/forgot-password': { title: 'Reset your password | The Loyalty Loop', description: 'Request a secure password-reset link for your Loyalty Loop account.' },
    '/dashboard': { title: 'Your loyalty cards | The Loyalty Loop', description: 'Your local rewards and loyalty cards.', },
    '/dashboard/discover': { title: 'Discover local shops | The Loyalty Loop', description: 'Explore local shops and their latest updates.' },
    '/dashboard/rewards': { title: 'Your rewards | The Loyalty Loop', description: 'View rewards that are ready to use.' },
    '/dashboard/news': { title: 'Shop news | The Loyalty Loop', description: 'Updates and announcements from local businesses.' },
    '/dashboard/favourites': { title: 'Favourite shops | The Loyalty Loop', description: 'Your saved local businesses.' },
    '/dashboard/profile': { title: 'Your profile | The Loyalty Loop', description: 'Manage your Loyalty Loop account.' },
    '/owner': { title: 'Business dashboard | The Loyalty Loop', description: 'Manage your business loyalty programme.' },
    '/owner/scan': { title: 'Scan customer card | The Loyalty Loop for Business', description: 'Award stamps and redeem rewards.' },
    '/owner/analytics': { title: 'Business analytics | The Loyalty Loop', description: 'Customer and loyalty insights for your business.' },
    '/owner/settings': { title: 'Shop settings | The Loyalty Loop', description: 'Manage your business profile and loyalty programme.' },
  }
  const meta = labels[pathname] ?? { title: 'The Loyalty Loop', description: 'Digital loyalty cards for independent neighbourhood shops.' }
  const pageOwnsMeta = pathname === '/' || pathname === '/dashboard/discover' || pathname.startsWith('/dashboard/shop/') || pathname === '/404'
  usePageMeta({ title: meta.title, description: meta.description, path: pathname, robots: privatePage ? 'noindex,nofollow,noarchive' : undefined, enabled: !pageOwnsMeta })
  return null
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <OwnerProvider>
            <BrowserRouter>
              <div className="fixed right-3 top-3 z-[70] rounded-xl border border-foreground/10 bg-card/90 p-0.5 shadow-sm backdrop-blur-md sm:right-5 sm:top-5">
                <ThemeToggle compact />
              </div>
              <Suspense fallback={<BarePageSkeleton />}>
                <UsageTracker />
                <RouteMeta />
                <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/dashboard" element={<Home />} />
                <Route path="/dashboard/discover" element={<DiscoverPage />} />
                <Route path="/dashboard/shop/:id" element={<ShopDetail />} />
                <Route path="/dashboard/rewards" element={<RewardsPage />} />
                <Route path="/dashboard/news" element={<NewsPage />} />
                <Route path="/dashboard/favourites" element={<FavouritesPage />} />
                <Route path="/dashboard/profile" element={<ProfilePage />} />
                <Route path="/dashboard/activity" element={<ActivityPage />} />
                <Route path="/dashboard/inbox" element={<InboxPage />} />
                <Route path="/dashboard/admin" element={<Navigate to="/access" replace />} />
                <Route path="/access" element={<AccessPanel />} />
                <Route path="/brand" element={<BrandWorkspace />} />
                <Route path="/owner" element={<OwnerAnalytics />} />
                <Route path="/owner/onboarding" element={<OwnerOnboarding />} />
                <Route path="/owner/scan" element={<OwnerScan />} />
                <Route path="/owner/tools" element={<OwnerTools />} />
                <Route path="/owner/tutorial" element={<OwnerTutorial />} />
                <Route path="/owner/settings" element={<OwnerSettings />} />
                <Route path="/owner/notifications" element={<OwnerNotifications />} />
                <Route path="/owner/announcements" element={<OwnerAnnouncements />} />
                <Route path="/owner/reviews" element={<OwnerReviews />} />
                <Route path="/owner/support" element={<OwnerSupport />} />
                <Route path="/login" element={<Login />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/whatsapp/onboarding" element={<WhatsAppOnboarding />} />
                <Route path="/whatsapp/card" element={<WhatsAppCard />} />
                <Route path="/whatsapp/start" element={<WhatsAppStart />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/signup/owner" element={<Signup asOwner />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
              <CookieConsent />
            </BrowserRouter>
          </OwnerProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}

export default App
