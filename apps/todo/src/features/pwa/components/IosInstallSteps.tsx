import { Share } from 'lucide-react'

/**
 * The only install route Safari offers, written out.
 *
 * iOS has no `beforeinstallprompt` and no API to trigger Add to Home Screen, so the
 * instruction *is* the feature. It names the Share icon rather than only describing
 * it, because "the share button" is genuinely hard to find on an iPad, and it says
 * where the sheet appears on each, because they differ.
 */
export function IosInstallSteps() {
  return (
    <ol className="space-y-1.5 text-[11px] text-text-muted leading-relaxed">
      <li className="flex gap-2">
        <span className="text-primary font-semibold shrink-0">1.</span>
        <span className="flex items-center gap-1 flex-wrap">
          Tap
          <Share className="w-3.5 h-3.5 text-primary inline-block" aria-hidden="true" />
          <span className="sr-only">the Share button</span>
          Share, at the bottom of Safari on an iPhone and the top on an iPad.
        </span>
      </li>
      <li className="flex gap-2">
        <span className="text-primary font-semibold shrink-0">2.</span>
        <span>Scroll down and choose <strong className="text-text-primary">Add to Home Screen</strong>.</span>
      </li>
      <li className="flex gap-2">
        <span className="text-primary font-semibold shrink-0">3.</span>
        <span>Tap <strong className="text-text-primary">Add</strong>. It opens full screen from then on, and works with no signal.</span>
      </li>
    </ol>
  )
}

export default IosInstallSteps
