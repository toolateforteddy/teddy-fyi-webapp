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
      <div className="bg-surface-tile border border-line-faint rounded-xl p-4 flex items-center gap-3">
        <CheckCircle2 className="w-8 h-8 text-success shrink-0" />
        <div>
          <h5 className="font-semibold text-sm text-text-primary">Installed</h5>
        </div>
      </div>
    )
  }

  if (kind === 'none') {
    return (
      <div className="bg-surface-tile border border-line-faint rounded-xl p-4 flex items-center gap-3">
        <Smartphone className="w-8 h-8 text-text-subtle shrink-0" />
        <div>
          <h5 className="font-semibold text-sm text-text-primary">Install from your browser&apos;s menu</h5>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-surface-tile border border-line-faint rounded-xl p-4 space-y-4">
      <div className="flex items-start gap-3">
        <Download className="w-8 h-8 text-primary shrink-0" />
        <div>
          <h5 className="font-semibold text-sm text-text-primary">
            {handheld ? 'Add Grocery to your home screen' : 'Install Grocery on this computer'}
          </h5>
        </div>
      </div>

      {kind === 'prompt' ? (
        <button
          onClick={() => {
            promptInstall().catch(() => {})
          }}
          className="w-full bg-surface-raised hover:bg-surface-hover text-text-primary border border-line py-2.5 rounded-lg text-xs font-bold transition-all active:scale-[0.99] flex items-center justify-center gap-1.5 cursor-pointer"
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
