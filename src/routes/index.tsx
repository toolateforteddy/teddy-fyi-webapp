import { Routes, Route } from 'react-router-dom'
import { LandingPage } from './LandingPage'
import { LoginPage } from './LoginPage'
import { ArticlesPage } from './ArticlesPage'
import { CrackedPage } from './CrackedPage'
import { DeviceLinkPage } from './DeviceLinkPage'
import { NotFoundPage } from './NotFoundPage'
import { AuthenticatedRoute } from './AuthenticatedRoute'
import { DashboardLayout } from '@/features/dashboard/components/DashboardLayout'
import { NeedPhase } from '@/features/grocery/components/NeedPhase'
import { PlanningPhase } from '@/features/grocery/components/PlanningPhase'
import { ShoppingPhase } from '@/features/grocery/components/ShoppingPhase'
import { SettingsPhase } from '@/features/grocery/components/SettingsPhase'

export function AppRoutes() {
  return (
    <Routes>
      {/* Public Landing Page */}
      <Route path="/" element={<LandingPage />} />

      {/* Public Articles Page */}
      <Route path="/articles" element={<ArticlesPage />} />

      {/* A recruiter asked; a chatbot answered. Public, with its methodology attached. */}
      <Route path="/cracked" element={<CrackedPage />} />

      {/* Public Login Page */}
      <Route path="/login" element={<LoginPage />} />

      {/* Tablet pairing. Public on purpose: the page signs itself in with
          Google, and the parent reaching it is not signed in on this browser. */}
      <Route path="/link" element={<DeviceLinkPage />} />

      {/* Authenticated /Grocery System Shell */}
      <Route 
        path="/grocery" 
        element={
          <AuthenticatedRoute>
            <DashboardLayout />
          </AuthenticatedRoute>
        }
      >
        {/* Needle List (Default) */}
        <Route index element={<NeedPhase />} />
        
        {/* Planning Phase list */}
        <Route path="planning" element={<PlanningPhase />} />
        
        {/* Shopping Phase list */}
        <Route path="shopping" element={<ShoppingPhase />} />
        
        {/* Sync Settings */}
        <Route path="settings" element={<SettingsPhase />} />
      </Route>

      {/* Anything unmatched says so and stays put. Redirecting here to "/"
          instead made a stale bundle -- one that predates a route -- look
          exactly like a broken server rule. */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default AppRoutes
