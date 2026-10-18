import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/lib/auth-context'
import { OwnerProvider } from '@/lib/owner-context'
import { Landing } from '@/pages/Landing'
const Home = lazy(() => import('@/pages/Home').then((m) => ({ default: m.Home })))
const ShopDetail = lazy(() => import('@/pages/ShopDetail').then((m) => ({ default: m.ShopDetail })))
const RewardsPage = lazy(() => import('@/pages/Rewards').then((m) => ({ default: m.RewardsPage })))
const NewsPage = lazy(() => import('@/pages/News').then((m) => ({ default: m.NewsPage })))
const FavouritesPage = lazy(() => import('@/pages/Favourites').then((m) => ({ default: m.FavouritesPage })))
const ProfilePage = lazy(() => import('@/pages/Profile').then((m) => ({ default: m.ProfilePage })))
const OwnerAnalytics = lazy(() => import('@/pages/owner/Analytics').then((m) => ({ default: m.OwnerAnalytics })))
const OwnerOnboarding = lazy(() => import('@/pages/owner/Onboarding').then((m) => ({ default: m.OwnerOnboarding })))
const OwnerScan = lazy(() => import('@/pages/owner/Scan').then((m) => ({ default: m.OwnerScan })))
const OwnerSettings = lazy(() => import('@/pages/owner/Settings').then((m) => ({ default: m.OwnerSettings })))
const OwnerAnnouncements = lazy(() => import('@/pages/owner/Announcements').then((m) => ({ default: m.OwnerAnnouncements })))
const OwnerReviews = lazy(() => import('@/pages/owner/Reviews').then((m) => ({ default: m.OwnerReviews })))
const OwnerSupport = lazy(() => import('@/pages/owner/Support').then((m) => ({ default: m.OwnerSupport })))
const AccessPanel = lazy(() => import('@/pages/AccessPanel').then((m) => ({ default: m.AccessPanel })))
const Login = lazy(() => import('@/pages/Login').then((m) => ({ default: m.Login })))
const Signup = lazy(() => import('@/pages/Signup').then((m) => ({ default: m.Signup })))
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword').then((m) => ({ default: m.ForgotPassword })))
const ResetPassword = lazy(() => import('@/pages/ResetPassword').then((m) => ({ default: m.ResetPassword })))
const ActivityPage = lazy(() => import('@/pages/Activity').then((m) => ({ default: m.ActivityPage })))
const InboxPage = lazy(() => import('@/pages/Inbox').then((m) => ({ default: m.InboxPage })))
const LegalPage = lazy(() => import('@/pages/Legal').then((m) => ({ default: m.LegalPage })))
import { CookieConsent } from '@/components/cookie-consent'
const OwnerTools = lazy(() => import('@/pages/owner/Tools').then((m) => ({ default: m.OwnerTools })))
const OwnerNotifications = lazy(() => import('@/pages/owner/Notifications').then((m) => ({ default: m.OwnerNotifications })))
const BrandWorkspace = lazy(() => import('@/pages/BrandWorkspace').then((m) => ({ default: m.BrandWorkspace })))
import { RouteTitle } from '@/components/route-title'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <OwnerProvider>
          <BrowserRouter>
            <RouteTitle />
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
              <Route path="/terms" element={<LegalPage type="terms" />} />
              <Route path="/privacy" element={<LegalPage type="privacy" />} />
              <Route path="/dashboard/admin" element={<Navigate to="/access" replace />} />
              <Route path="/access" element={<AccessPanel />} />
              <Route path="/brand" element={<BrandWorkspace />} />
              <Route path="/owner" element={<OwnerAnalytics />} />
              <Route path="/owner/onboarding" element={<OwnerOnboarding />} />
              <Route path="/owner/scan" element={<OwnerScan />} />
              <Route path="/owner/tools" element={<OwnerTools />} />
              <Route path="/owner/settings" element={<OwnerSettings />} />
              <Route path="/owner/notifications" element={<OwnerNotifications />} />
              <Route path="/owner/announcements" element={<OwnerAnnouncements />} />
              <Route path="/owner/reviews" element={<OwnerReviews />} />
              <Route path="/owner/support" element={<OwnerSupport />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/signup/owner" element={<Signup asOwner />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
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
