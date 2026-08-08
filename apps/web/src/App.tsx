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
import { OwnerAnalytics } from '@/pages/owner/Analytics'
import { OwnerOnboarding } from '@/pages/owner/Onboarding'
import { OwnerScan } from '@/pages/owner/Scan'
import { OwnerSettings } from '@/pages/owner/Settings'
import { OwnerAnnouncements } from '@/pages/owner/Announcements'
import { OwnerReviews } from '@/pages/owner/Reviews'
import { OwnerSupport } from '@/pages/owner/Support'
import { AccessPanel } from '@/pages/AccessPanel'
import { Login } from '@/pages/Login'
import { Signup } from '@/pages/Signup'
import { ForgotPassword } from '@/pages/ForgotPassword'
import { ResetPassword } from '@/pages/ResetPassword'
import { ActivityPage } from '@/pages/Activity'
import { InboxPage } from '@/pages/Inbox'
import { CookieConsent } from '@/components/cookie-consent'
import { OwnerTools } from '@/pages/owner/Tools'
import { OwnerNotifications } from '@/pages/owner/Notifications'
import { BrandWorkspace } from '@/pages/BrandWorkspace'
import { AuthCallback } from '@/pages/AuthCallback'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <OwnerProvider>
          <BrowserRouter>
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
            </Routes>
            <CookieConsent />
          </BrowserRouter>
        </OwnerProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
