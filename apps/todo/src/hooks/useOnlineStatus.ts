import { useSyncExternalStore } from 'react'

/**
 * Whether the browser thinks it has a network.
 *
 * `navigator.onLine` is famously weak -- it reports "connected to *something*",
 * which a captive portal or a dead Wi-Fi router both satisfy. That is fine for what
 * it is used for here: telling the user why their changes have not gone up yet. A
 * false "online" costs a slightly wrong label until the next failed sync; a false
 * "offline" costs nothing, because the queue flushes on the `online` event anyway.
 * It is not used to decide whether to *attempt* a sync -- the attempt is always the
 * better test of the network than the flag is.
 *
 * useSyncExternalStore rather than useState + useEffect so the first render already
 * has the real value instead of a default that corrects itself a tick later.
 */

function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

function getSnapshot(): boolean {
  // Absent in some embedded webviews; assume connected rather than claiming an
  // outage that is not there.
  return typeof navigator.onLine === 'boolean' ? navigator.onLine : true
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => true)
}
