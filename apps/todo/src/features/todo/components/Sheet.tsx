import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

/**
 * A bottom sheet on a phone, a centred dialog on anything wider. Escape and the scrim close
 * it. Every dialog in the app is one of these, so they all dismiss the same way.
 */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-x-0 top-0 z-40 flex items-end sm:items-center justify-center"
      style={{ bottom: 'var(--keyboard-inset)' }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button type="button" aria-label="Close" className="absolute inset-0 bg-scrim/70 cursor-default" onClick={onClose} />
      <div className="relative app-frame max-h-[85%] overflow-y-auto bg-surface-raised border border-line rounded-t-2xl sm:rounded-2xl shadow-[var(--shadow-sheet)] pb-[env(safe-area-inset-bottom)]">
        <div className="sticky top-0 bg-surface-raised flex items-center justify-between px-5 pt-4 pb-2 app-chrome">
          <h2 className="text-base font-bold text-text-primary truncate">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-2 -mr-2 text-text-muted hover:text-text-primary cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 pb-5">{children}</div>
      </div>
    </div>
  )
}

/** A full-width row in a sheet's action list. */
export function SheetAction({
  icon,
  label,
  onClick,
  danger,
  detail,
}: {
  icon: ReactNode
  label: string
  onClick: () => void
  danger?: boolean
  detail?: string | null
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-surface-hover text-left cursor-pointer ${danger ? 'text-danger' : 'text-text-primary'}`}
    >
      <span className="w-5 h-5 flex items-center justify-center shrink-0">{icon}</span>
      <span className="flex-1 text-sm font-medium">{label}</span>
      {detail && <span className="text-xs text-text-muted truncate max-w-[45%]">{detail}</span>}
    </button>
  )
}

export const inputClass =
  'w-full bg-inset border border-line focus:border-primary outline-none text-text-primary text-sm px-3 py-2.5 rounded-lg'

export const primaryButtonClass =
  'px-4 py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-on-primary text-sm font-semibold cursor-pointer disabled:opacity-40'

export const quietButtonClass =
  'px-4 py-2.5 rounded-lg border border-line hover:bg-surface-hover text-text-secondary text-sm font-semibold cursor-pointer'
