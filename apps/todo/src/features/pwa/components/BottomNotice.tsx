import type { ReactNode } from 'react'

/**
 * The slot notices live in: a floating card above the bottom nav.
 *
 * Shared so that the update notice and the install notice cannot drift apart, and
 * -- more to the point -- cannot end up at two different heights and overlap. It
 * aligns to the same centred frame as everything else via --app-frame-width, clears
 * the nav with --app-nav-height, and sits above the add-task bar rather than over
 * it, which is about 4rem tall. Getting that wrong hides the primary action behind
 * a dismissible notice.
 */
export function BottomNotice({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="app-chrome fixed left-1/2 -translate-x-1/2 z-40 w-full px-3 pointer-events-none"
      style={{
        maxWidth: 'var(--app-frame-width)',
        bottom: 'calc(var(--app-nav-height) + env(safe-area-inset-bottom) + 4.5rem)',
      }}
    >
      <div className="pointer-events-auto rounded-xl border border-line bg-surface-tile px-3 py-2.5 shadow-[var(--shadow-dialog)] animate-in slide-in-from-bottom duration-250 ease-out">
        {children}
      </div>
    </div>
  )
}

export default BottomNotice
