import type { ReactNode } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { ErrorBoundary } from '@shared/ErrorBoundary'

interface AppProviderProps {
  children: ReactNode
}

// No AuthProvider here, unlike the grocery app. Nothing on this site is behind a
// login: the three pages are public, and the one place that used to read auth
// state (the landing page's call to action) now links to a different origin,
// where the session lives and is not readable from here anyway.
export function AppProvider({ children }: AppProviderProps) {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default AppProvider
