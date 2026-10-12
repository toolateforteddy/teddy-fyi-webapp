import { Routes, Route } from 'react-router-dom'
import { LoginPage } from './LoginPage'
import { InvitePage } from './InvitePage'
import { NotFoundPage } from './NotFoundPage'
import { AuthenticatedRoute } from './AuthenticatedRoute'
import { TodoProvider } from '@/features/todo/TodoContext'
import { TodoApp } from '@/features/todo/components/TodoApp'

export function AppRoutes() {
  return (
    <Routes>
      {/* Public, and it says so when this browser holds no invite: the API refuses a
          login from this origin without one, so a Google button alone would be a dead end. */}
      <Route path="/login" element={<LoginPage />} />

      {/* Where an invite link lands. It hands the code to the API, which keeps it in an
          HttpOnly cookie, then goes on to /login. Public because the visitor has no
          session yet; that is what the invite is for. */}
      <Route path="/invite/:code" element={<InvitePage />} />

      {/* A link whose code got cut off still lands somewhere that explains itself. */}
      <Route path="/invite" element={<InvitePage />} />

      {/* The app is the root of this origin, so the manifest's start_url is "/" and an
          installed app opens straight into the list. */}
      <Route
        path="/"
        element={
          <AuthenticatedRoute>
            <TodoProvider>
              <TodoApp />
            </TodoProvider>
          </AuthenticatedRoute>
        }
      />

      {/* Anything unmatched says so and stays put, as on grocery: a stale bundle that
          predates a route must not look like a broken server rule. */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default AppRoutes
