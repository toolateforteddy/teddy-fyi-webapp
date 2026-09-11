import type { ReactNode } from 'react'

/**
 * The slot notices live in: a floating card above the bottom nav.
 *
 * Shared so that the update notice and the install notice cannot drift apart, and
 * -- more to the point -- cannot end up at two different heights and overlap. It
 * aligns to the same centred frame as everything else via --app-frame-width, clears
 * the nav with --app-nav-height, and sits above the add-item FAB rather than over
 * it: that button is at nav + 1rem and is h-14 (3.5rem), so this is its top edge
 * plus a gap. Getting that wrong hides the primary action behind a dismissible
 * notice.
 */
export function BottomNotice({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="app-chrome fixed left-1/2 -translate-x-1/2 z-40 w-full px-3 pointer-events-none"
      style={{
        maxWidth: 'var(--app-frame-width)',
        bottom: 'calc(var(--app-nav-height) + env(safe-area-inset-bottom) + 1rem + 3.5rem + 0.75rem)',
      }}
    >
      <div className="pointer-events-auto rounded-xl border border-neutral-800 bg-surface-tile px-3 py-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.6)] animate-in slide-in-from-bottom duration-250 ease-out">
        {children}
      </div>
    </div>
  )
}

export default BottomNotice
