import { useEffect, useState } from 'react'
import { ArrowUpCircle, X } from 'lucide-react'
import { subscribeToUpdates, applyUpdate } from '@/pwa'

/**
 * "A new version is ready" -- the only thing that tells anyone a deploy happened.
 *
 * Sits above the bottom nav rather than at the top, because on a phone the top of
 * this app is the list header and the bottom is where the thumb already is. It
 * aligns to the same centred frame as everything else via --app-frame-width, and
 * clears the nav bar with --app-nav-height so it never covers a destination.
 *
 * Dismissing only hides it. The waiting worker stays waiting and still takes over at
 * the next cold launch, so "not now" costs the user nothing and delays nothing
 * except this reload. It does not come back for the same version, which is the
 * point of dismissing it.
 */
export function UpdateBanner() {
  const [updateReady, setUpdateReady] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [reloading, setReloading] = useState(false)

  useEffect(() => subscribeToUpdates(setUpdateReady), [])

  if (!updateReady || dismissed) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="app-chrome fixed left-1/2 -translate-x-1/2 z-40 w-full px-3 pointer-events-none"
      style={{
        maxWidth: 'var(--app-frame-width)',
        // Clears the add-item FAB rather than covering it: that button sits at
        // nav + 1rem and is h-14 (3.5rem), so this is its top edge plus a gap.
        // Getting this wrong hides the primary action behind a dismissible notice.
        bottom: 'calc(var(--app-nav-height) + env(safe-area-inset-bottom) + 1rem + 3.5rem + 0.75rem)',
      }}
    >
      <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-neutral-800 bg-surface-tile px-3 py-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.6)] animate-in slide-in-from-bottom duration-250 ease-out">
        <ArrowUpCircle className="w-4 h-4 shrink-0 text-primary" aria-hidden="true" />

        <p className="flex-1 text-xs text-text-primary leading-snug">
          A new version is ready.
        </p>

        <button
          type="button"
          onClick={() => {
            setReloading(true)
            applyUpdate()
          }}
          disabled={reloading}
          className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-black transition-opacity disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          {reloading ? 'Reloading...' : 'Reload'}
        </button>

        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss until the next launch"
          className="shrink-0 rounded-lg p-1.5 text-text-muted transition-colors hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

export default UpdateBanner
