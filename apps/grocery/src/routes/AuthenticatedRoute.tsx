import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'

interface AuthenticatedRouteProps {
  children?: ReactNode
}

export function AuthenticatedRoute({ children }: AuthenticatedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-canvas text-text-primary flex flex-col justify-center items-center font-sans antialiased">
        <div className="app-frame min-h-dvh bg-canvas flex flex-col items-center justify-center border-x border-line-faint shadow-[var(--shadow-frame)] space-y-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <span className="text-xs text-text-muted font-medium tracking-wide">
            Restoring session...
          </span>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return children ? <>{children}</> : <Outlet />
}

export default AuthenticatedRoute
