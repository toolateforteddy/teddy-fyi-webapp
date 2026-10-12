import { useCallback, useSyncExternalStore } from 'react'

/**
 * Subscribes to a CSS media query and re-renders when it flips.
 *
 * useSyncExternalStore rather than useState + useEffect so the very first
 * render already has the right answer: an effect-based version paints the
 * portrait layout for a frame before correcting itself, which reads as a
 * flicker every time the device is rotated back into the app.
 *
 * jsdom (and any environment without matchMedia) reports `false`, which is the
 * phone-portrait default the layout is designed around.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return () => {}
      }

      const list = window.matchMedia(query)

      // Safari only gained addEventListener on MediaQueryList in 14; the app
      // supports 16.4+, but addListener costs one line to keep as a fallback.
      if (typeof list.addEventListener === 'function') {
        list.addEventListener('change', onChange)
        return () => list.removeEventListener('change', onChange)
      }

      list.addListener(onChange)
      return () => list.removeListener(onChange)
    },
    [query]
  )

  const getSnapshot = useCallback(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false
    }
    return window.matchMedia(query).matches
  }, [query])

  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
