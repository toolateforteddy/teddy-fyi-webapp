import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import { storage } from '@/utils/storage'
import { subscribeToUpdates } from '@/pwa'
import { subscribeToInstall, promptInstall, isHandheld, type InstallKind } from '../install'
import { BottomNotice } from './BottomNotice'
import { IosInstallSteps } from './IosInstallSteps'

/**
 * "Add to your home screen", offered once and then not again.
 *
 * Three rules keep this from being the nag every PWA banner turns into:
 *
 *   - **Phones and tablets only.** See isHandheld. A laptop can install this and
 *     Settings will happily do it, but being asked on one is noise: the pitch for
 *     installing is a home-screen icon that opens with no signal.
 *   - **Dismissal persists.** It is written to localStorage rather than held in
 *     state, because a banner that comes back on the next launch is one the user has
 *     to dismiss forever. Settings keeps the offer for anyone who changes their mind.
 *   - **An update wins.** Both notices use the same slot, and a pending update is
 *     the more urgent of the two, so this stays out of the way while one is waiting.
 *
 * Nothing renders at all unless the browser has said the app qualifies (Chrome and
 * friends) or the platform has no API and needs the instructions instead (iOS).
 */
const DISMISSED_KEY = 'grocery_install_dismissed'

export function InstallBanner() {
  const [kind, setKind] = useState<InstallKind>('none')
  // Read once: a pointer does not change under a running page, and re-reading it
  // per render would be a media query on every keystroke elsewhere in the tree.
  const [handheld] = useState(() => isHandheld())
  const [updateReady, setUpdateReady] = useState(false)
  const [dismissed, setDismissed] = useState(() =>
    Boolean(storage.getItem<boolean>(DISMISSED_KEY, false))
  )
  const [showSteps, setShowSteps] = useState(false)

  useEffect(() => subscribeToInstall(setKind), [])
  useEffect(() => subscribeToUpdates(setUpdateReady), [])

  if (kind === 'none' || !handheld || dismissed || updateReady) return null

  const dismiss = () => {
    storage.setItem(DISMISSED_KEY, true)
    setDismissed(true)
  }

  return (
    <BottomNotice>
      <div className="flex items-center gap-3">
        <Download className="w-4 h-4 shrink-0 text-primary" aria-hidden="true" />

        <p className="flex-1 text-xs text-text-primary leading-snug">
          Add Grocery to your home screen.
        </p>

        {kind === 'prompt' ? (
          <button
            type="button"
            onClick={() => {
              promptInstall().catch(() => {})
            }}
            className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
          >
            Install
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowSteps(open => !open)}
            aria-expanded={showSteps}
            className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
          >
            {showSteps ? 'Hide' : 'How'}
          </button>
        )}

        <button
          type="button"
          onClick={dismiss}
          aria-label="Do not offer this again"
          className="shrink-0 rounded-lg p-1.5 text-text-muted transition-colors hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>

      {showSteps && (
        <div className="mt-2.5 border-t border-line pt-2.5">
          <IosInstallSteps />
        </div>
      )}
    </BottomNotice>
  )
}

export default InstallBanner
