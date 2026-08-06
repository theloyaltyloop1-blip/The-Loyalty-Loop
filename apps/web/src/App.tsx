import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/lib/auth-context'
import { OwnerProvider } from '@/lib/owner-context'
import { Landing } from '@/pages/Landing'
import { Home } from '@/pages/Home'
import { MapPage } from '@/pages/Map'
import { ShopDetail } from '@/pages/ShopDetail'
import { ComingSoon } from '@/pages/ComingSoon'
import { OwnerAnalytics } from '@/pages/owner/Analytics'
import { OwnerSettings } from '@/pages/owner/Settings'
import { OwnerComingSoon } from '@/pages/owner/OwnerComingSoon'
import { Login } from '@/pages/Login'
import { Signup } from '@/pages/Signup'
import { ForgotPassword } from '@/pages/ForgotPassword'
import { ResetPassword } from '@/pages/ResetPassword'

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
              <Route path="/dashboard/map" element={<MapPage />} />
              <Route path="/dashboard/shop/:id" element={<ShopDetail />} />
              <Route path="/dashboard/rewards" element={<ComingSoon title="Rewards" />} />
              <Route path="/dashboard/news" element={<ComingSoon title="News" />} />
              <Route path="/dashboard/favourites" element={<ComingSoon title="Favourites" />} />
              <Route path="/dashboard/profile" element={<ComingSoon title="Profile" />} />
              <Route path="/dashboard/admin" element={<ComingSoon title="Admin" />} />
              <Route path="/owner" element={<OwnerAnalytics />} />
              <Route path="/owner/settings" element={<OwnerSettings />} />
              <Route path="/owner/notifications" element={<OwnerComingSoon title="Notifications" />} />
              <Route path="/owner/announcements" element={<OwnerComingSoon title="Announcements" />} />
              <Route path="/owner/reviews" element={<OwnerComingSoon title="Reviews" />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/signup/owner" element={<Signup asOwner />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
            </Routes>
          </BrowserRouter>
        </OwnerProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
