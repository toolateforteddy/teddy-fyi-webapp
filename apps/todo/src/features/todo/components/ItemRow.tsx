import { ArrowDown, ArrowUp, CalendarDays, History, MoreVertical, Repeat, RefreshCw, Star } from 'lucide-react'
import type { TodoItem } from '../types'
import { iconLigature } from '../icons'
import { recurrenceLabel } from '../rules'

/**
 * One task, drawn as the Android row is: a hexagonal checkbox in the task's space colour,
 * its icon, its title, the badges that say why it is where it is, and the priority star.
 *
 * The space colour is data rather than design — any of seven swatches, chosen per space —
 * so it is the one colour here that arrives as an inline style rather than a token.
 */
export function ItemRow({
  item,
  color,
  checked,
  struck,
  isChild,
  editMode,
  showDate,
  onToggle,
  onOpen,
  onStar,
  onMove,
}: {
  item: TodoItem
  color: string
  checked: boolean
  struck: boolean
  isChild?: boolean
  editMode: boolean
  showDate?: boolean
  onToggle: (checked: boolean) => void
  onOpen: () => void
  onStar: () => void
  onMove: (move: 'up' | 'down') => void
}) {
  const icon = iconLigature(item.icon)
  const recurrence = recurrenceLabel(item.recurrenceRule)
  const rolledOver = item.lastScheduledDate !== null && item.scheduledDate === null && !item.isCompleted

  return (
    <div
      className={`clipped flex items-stretch gap-0 bg-surface-tile ${isChild ? 'ml-8' : ''}`}
      style={{ boxShadow: rolledOver ? 'inset 3px 0 0 var(--palette-priority-medium)' : `inset 3px 0 0 ${color}` }}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label={checked ? `Untick ${item.title}` : `Tick ${item.title}`}
        onClick={() => onToggle(!checked)}
        className="pl-4 pr-3 flex items-center cursor-pointer app-chrome"
      >
        <span className="hex w-5 h-5 flex items-center justify-center" style={{ background: color }}>
          <span className="hex w-[16px] h-[16px]" style={{ background: checked ? color : 'var(--palette-surface-tile)' }} />
        </span>
      </button>

      <button type="button" onClick={onOpen} className="flex-1 min-w-0 py-3 pr-2 text-left cursor-pointer">
        <div className="flex items-center gap-2 min-w-0">
          {icon && (
            <span className="material-symbols-rounded text-[16px] shrink-0" style={{ color, opacity: 0.7 }} aria-hidden="true">
              {icon}
            </span>
          )}
          <span className={`text-sm font-medium truncate ${struck ? 'line-through text-text-faint' : 'text-text-primary'}`}>
            {item.title}
          </span>
        </div>
        {(item.description || recurrence || item.isDaily || rolledOver || item.dueDate !== null || (showDate && item.scheduledDate)) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-[11px] text-text-muted">
            {rolledOver && (
              <span className="flex items-center gap-1 text-priority-medium">
                <History className="w-3 h-3" /> From {item.lastScheduledDate}
              </span>
            )}
            {item.isDaily && (
              <span className="flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> Daily
              </span>
            )}
            {recurrence && (
              <span className="flex items-center gap-1">
                <Repeat className="w-3 h-3" /> {recurrence}
              </span>
            )}
            {showDate && item.scheduledDate && (
              <span className="flex items-center gap-1" style={{ color }}>
                <CalendarDays className="w-3 h-3" /> {item.scheduledDate}
              </span>
            )}
            {item.dueDate !== null && (
              <span className="text-danger">Due: {new Date(item.dueDate).toISOString().slice(0, 10)}</span>
            )}
            {item.description && <span className="truncate max-w-full">{item.description}</span>}
          </div>
        )}
      </button>

      {editMode ? (
        <div className="flex items-center pr-1 app-chrome">
          <button type="button" aria-label="Move up" onClick={() => onMove('up')} className="p-2 text-text-muted hover:text-text-primary cursor-pointer">
            <ArrowUp className="w-4 h-4" />
          </button>
          <button type="button" aria-label="Move down" onClick={() => onMove('down')} className="p-2 text-text-muted hover:text-text-primary cursor-pointer">
            <ArrowDown className="w-4 h-4" />
          </button>
        </div>
      ) : null}

      {(item.priority > 0 || editMode) && (
        <button
          type="button"
          aria-label={item.priority >= 2 ? 'Remove star' : 'Star'}
          aria-pressed={item.priority >= 2}
          onClick={onStar}
          className="px-2 flex items-center cursor-pointer app-chrome"
        >
          <Star
            className={`w-4 h-4 ${item.priority >= 2 ? 'text-priority-high fill-current' : item.priority === 1 ? 'text-priority-medium' : 'text-text-faint'}`}
          />
        </button>
      )}

      <button type="button" aria-label={`More for ${item.title}`} onClick={onOpen} className="pr-3 pl-1 flex items-center text-text-faint hover:text-text-primary cursor-pointer app-chrome">
        <MoreVertical className="w-4 h-4" />
      </button>
    </div>
  )
}
