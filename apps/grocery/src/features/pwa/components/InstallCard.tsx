import { useEffect, useState } from 'react'
import { Download, CheckCircle2, Smartphone } from 'lucide-react'
import { subscribeToInstall, promptInstall, isStandalone, isHandheld, type InstallKind } from '../install'
import { IosInstallSteps } from './IosInstallSteps'

/**
 * The install offer in Settings -- the one that does not go away.
 *
 * The banner is dismissible and stays dismissed, so this is where somebody who
 * tapped the X, or who only later decided they wanted the app on their home screen,
 * finds it again. It also reports the finished state, because "am I actually running
 * the installed one?" is otherwise unanswerable from inside the app.
 *
 * Unlike the banner, this shows on a desktop too. The banner is withheld there
 * because asking is noise; offering is not, and somebody who has opened Settings
 * looking for this has already decided. The wording follows the device, because a
 * laptop has no home screen to add anything to.
 */
export function InstallCard() {
  const [kind, setKind] = useState<InstallKind>('none')
  const [standalone] = useState(() => isStandalone())
  const [handheld] = useState(() => isHandheld())

  useEffect(() => subscribeToInstall(setKind), [])

  if (standalone) {
    return (
      <div className="bg-surface-tile border border-neutral-900 rounded-xl p-4 flex items-start gap-3">
        <CheckCircle2 className="w-8 h-8 text-emerald-500 shrink-0" />
        <div>
          <h5 className="font-semibold text-sm text-white">Running as an installed app</h5>
          <p className="text-[11px] text-text-muted mt-0.5">
            Your lists open without a browser and load with no signal.
          </p>
        </div>
      </div>
    )
  }

  if (kind === 'none') {
    return (
      <div className="bg-surface-tile border border-neutral-900 rounded-xl p-4 flex items-start gap-3">
        <Smartphone className="w-8 h-8 text-neutral-500 shrink-0" />
        <div>
          <h5 className="font-semibold text-sm text-white">Install from your browser</h5>
          <p className="text-[11px] text-text-muted mt-0.5">
            This browser has not offered an install for Grocery. Most browsers keep the
            option in their own menu, usually as "Install app" or "Add to Home screen".
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-surface-tile border border-neutral-900 rounded-xl p-4 space-y-4">
      <div className="flex items-start gap-3">
        <Download className="w-8 h-8 text-primary shrink-0" />
        <div>
          <h5 className="font-semibold text-sm text-white">
            {handheld ? 'Add Grocery to your home screen' : 'Install Grocery on this computer'}
          </h5>
          <p className="text-[11px] text-text-muted mt-0.5">
            {handheld
              ? 'Opens full screen, without the browser bars, and launches with no signal.'
              : 'Opens in its own window, without the browser bars, and works with no network.'}
          </p>
        </div>
      </div>

      {kind === 'prompt' ? (
        <button
          onClick={() => {
            promptInstall().catch(() => {})
          }}
          className="w-full bg-neutral-900 hover:bg-neutral-855 text-white border border-neutral-800 py-2.5 rounded-lg text-xs font-bold transition-all active:scale-[0.99] flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          Install
        </button>
      ) : (
        <IosInstallSteps />
      )}
    </div>
  )
}

export default InstallCard
