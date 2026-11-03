import { useEffect, useState } from 'react'
import { Download, Smartphone } from 'lucide-react'
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

  // Installed: nothing to offer, and a row saying so is a secondary label.
  if (standalone) return null

  if (kind === 'none') {
    return (
      <div className="flex items-center gap-3 px-4 h-12 text-sm font-medium text-text-muted">
        <Smartphone className="w-4 h-4 shrink-0" />
        Install from your browser&apos;s menu
      </div>
    )
  }

  if (kind === 'prompt') {
    return (
      <button
        onClick={() => {
          promptInstall().catch(() => {})
        }}
        className="w-full flex items-center gap-3 px-4 h-12 text-sm font-medium text-text-primary hover:bg-surface-hover cursor-pointer"
      >
        <Download className="w-4 h-4 text-primary shrink-0" />
        {handheld ? 'Add to home screen' : 'Install'}
      </button>
    )
  }

  return (
    <div className="px-4 py-3 space-y-3">
      <div className="flex items-center gap-3 text-sm font-medium text-text-primary">
        <Download className="w-4 h-4 text-primary shrink-0" />
        Add to home screen
      </div>
      <IosInstallSteps />
    </div>
  )
}

export default InstallCard
