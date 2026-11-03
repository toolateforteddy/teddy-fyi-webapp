import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { subscribeToInstall, promptInstall, isStandalone, type InstallKind } from '../install'
import { IosInstallSteps } from './IosInstallSteps'

/**
 * The install offer in the menu -- the one that does not go away.
 *
 * The banner is dismissible and stays dismissed, so this is where somebody who tapped the
 * X, or who only later decided they wanted the app, finds it again. It shows only when there
 * is something to do: an Install row where the browser offers one, Safari's steps where
 * the steps are the only route, and nothing once installed or where the browser offers no
 * install at all.
 */
export function InstallAction() {
  const [kind, setKind] = useState<InstallKind>('none')
  const [standalone] = useState(() => isStandalone())

  useEffect(() => subscribeToInstall(setKind), [])

  if (standalone || kind === 'none') return null

  if (kind === 'instructions') {
    return (
      <div className="px-3 py-3">
        <IosInstallSteps />
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        promptInstall().catch(() => {})
      }}
      className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-surface-hover text-left text-text-primary cursor-pointer"
    >
      <span className="w-5 h-5 flex items-center justify-center shrink-0">
        <Download className="w-4 h-4" />
      </span>
      <span className="flex-1 text-sm font-medium">Install</span>
    </button>
  )
}

export default InstallAction
