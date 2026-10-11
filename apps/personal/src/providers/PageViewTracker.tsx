import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

declare global {
  interface Window {
    goatcounter?: { count: (vars?: { path?: string }) => void }
  }
}

// Reports in-app navigations to GoatCounter (see the script tag in index.html).
// The first location is skipped because count.js already counted the page load;
// every later one is a route change that never reached the server. If the script
// is blocked or has not loaded yet, there is nothing to call and the view is
// simply not counted.
export function PageViewTracker() {
  const { pathname } = useLocation()
  const isFirst = useRef(true)

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false
      return
    }
    window.goatcounter?.count({ path: pathname })
  }, [pathname])

  return null
}
