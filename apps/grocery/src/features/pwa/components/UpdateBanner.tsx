import { useEffect, useState } from 'react'
import { ArrowUpCircle, X } from 'lucide-react'
import { subscribeToUpdates, applyUpdate } from '@/pwa'
import { BottomNotice } from './BottomNotice'

/**
 * "A new version is ready" -- the only thing that tells anyone a deploy happened.
 *
 * Sits at the bottom rather than the top, because on a phone the top of this app is
 * the list header and the bottom is where the thumb already is. See BottomNotice for
 * the placement itself.
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
    <BottomNotice>
      <div className="flex items-center gap-3">
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
    </BottomNotice>
  )
}

export default UpdateBanner
