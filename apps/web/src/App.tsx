import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/lib/auth-context'
import { OwnerProvider } from '@/lib/owner-context'
import { Landing } from '@/pages/Landing'
import { Home } from '@/pages/Home'
import { ShopDetail } from '@/pages/ShopDetail'
import { RewardsPage } from '@/pages/Rewards'
import { NewsPage } from '@/pages/News'
import { FavouritesPage } from '@/pages/Favourites'
import { ProfilePage } from '@/pages/Profile'
import { Login } from '@/pages/Login'
import { Signup } from '@/pages/Signup'
import { ForgotPassword } from '@/pages/ForgotPassword'
import { ResetPassword } from '@/pages/ResetPassword'
import { ActivityPage } from '@/pages/Activity'
import { InboxPage } from '@/pages/Inbox'
import { CookieConsent } from '@/components/cookie-consent'
import { AuthCallback } from '@/pages/AuthCallback'
import { NotFound } from '@/pages/NotFound'

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
const AccessPanel = lazy(() => import('@/pages/AccessPanel').then((m) => ({ default: m.AccessPanel })))
const BrandWorkspace = lazy(() => import('@/pages/BrandWorkspace').then((m) => ({ default: m.BrandWorkspace })))

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <OwnerProvider>
          <BrowserRouter>
            <Suspense fallback={null}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/dashboard" element={<Home />} />
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
  )
}

export default App
