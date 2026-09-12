import { Pointer, MoveLeft, MoveHorizontal, Ban } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { GestureKind } from '../content'
import { cn } from '@/utils/cn'

/**
 * One gesture, drawn so it reads as an instruction rather than a paragraph.
 *
 * The whole reason this screen exists is that the gestures are invisible in the app itself,
 * so each one gets its own glyph, its own label, and a dashed edge that separates it from the
 * prose around it. Everything else on the page is quieter on purpose.
 */

const GLYPHS: Record<GestureKind, LucideIcon> = {
  tap: Pointer,
  swipe: MoveLeft,
  scroll: MoveHorizontal,
  press: Ban,
}

interface GestureCalloutProps {
  gesture: GestureKind
  verb: string
  what: string
  then?: string
}

export function GestureCallout({ gesture, verb, what, then }: GestureCalloutProps) {
  const Glyph = GLYPHS[gesture]
  // A gesture the app does not have is a correction, not an instruction, so it is drawn in
  // the muted neutral rather than the accent every real gesture uses.
  const isDisabled = gesture === 'press'

  return (
    <div
      className={cn(
        'flex gap-3 rounded-xl border border-dashed p-3',
        isDisabled ? 'border-line' : 'border-primary/30'
      )}
    >
      <div
        className={cn(
          'w-10 h-10 shrink-0 rounded-lg flex items-center justify-center',
          isDisabled ? 'bg-surface-raised text-text-muted' : 'bg-primary/10 text-primary'
        )}
      >
        <Glyph className="w-5 h-5" aria-hidden="true" />
      </div>

      <div className="min-w-0">
        <span
          className={cn(
            'block text-[10px] font-bold uppercase tracking-[0.14em]',
            isDisabled ? 'text-text-muted' : 'text-primary'
          )}
        >
          {verb}
        </span>
        <span className="block text-sm font-semibold text-text-primary leading-snug mt-0.5">{what}</span>
        {then && <p className="text-xs text-text-muted leading-relaxed mt-1.5">{then}</p>}
      </div>
    </div>
  )
}
