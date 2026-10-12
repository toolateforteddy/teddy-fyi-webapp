import { useState } from 'react'
import {
  AlarmClock,
  ArrowDownToLine,
  ArrowUpToLine,
  CalendarDays,
  CalendarPlus,
  Inbox,
  ListPlus,
  Pencil,
  RefreshCw,
  Repeat,
  Shapes,
  Star,
  Sun,
  Tag,
  Trash2,
} from 'lucide-react'
import type { TodoItem } from '../types'
import { useTodo } from '../TodoContext'
import { TODO_ICONS, iconLigature } from '../icons'
import { RECURRENCE_OPTIONS, addDays, customDaysRule, recurrenceLabel, snoozeMonths, todayIso } from '../rules'
import { Sheet, SheetAction, inputClass, primaryButtonClass, quietButtonClass } from './Sheet'
import { PlainTextField } from './PlainTextField'

type View = 'menu' | 'edit' | 'schedule' | 'recurrence' | 'snooze' | 'icon' | 'space' | 'subtask' | 'delete'

/**
 * Everything a task can have done to it: the Android row menu (`TodoItemMenu.kt`) and the
 * dialogs it opens, as one sheet whose body swaps between them.
 */
export function ItemSheet({ item, onClose }: { item: TodoItem; onClose: () => void }) {
  const { items, lists, updateItem, deleteItem, moveItem, addItem, assignIcon } = useTodo()
  const [view, setView] = useState<View>('menu')
  // The sheet is opened on a snapshot; read the live row so the menu shows each change.
  const live = items.find((i) => i.id === item.id && !i.isDeleted) ?? item
  const space = lists.find((l) => l.id === live.listId)
  const today = todayIso()
  const isChild = live.parentId !== null

  const done = () => setView('menu')

  if (view === 'edit') return <EditView item={live} onDone={done} onClose={onClose} save={(patch) => updateItem(live.id, patch)} />

  if (view === 'subtask') {
    return (
      <TextPrompt
        title={`Subtask of ${live.title}`}
        placeholder="What needs doing?"
        submitLabel="Add"
        onClose={onClose}
        onSubmit={(title) => {
          addItem(title, { parentId: live.id })
          done()
        }}
      />
    )
  }

  if (view === 'schedule') {
    return (
      <Sheet title="Schedule" onClose={onClose}>
        <input
          type="date"
          aria-label="Date"
          defaultValue={live.scheduledDate ?? today}
          className={inputClass}
          onChange={(event) => {
            if (event.target.value) updateItem(live.id, { scheduledDate: event.target.value })
          }}
        />
        <div className="flex gap-2 justify-end mt-4">
          <button type="button" className={quietButtonClass} onClick={() => (updateItem(live.id, { scheduledDate: null }), done())}>
            Clear
          </button>
          <button type="button" className={primaryButtonClass} onClick={done}>
            Done
          </button>
        </div>
      </Sheet>
    )
  }

  if (view === 'recurrence') return <RecurrenceView item={live} onClose={onClose} onDone={done} save={(rule) => updateItem(live.id, { recurrenceRule: rule })} />

  if (view === 'snooze') {
    return (
      <SnoozeView
        onClose={onClose}
        onSnooze={(amount, unit) => {
          const base = live.scheduledDate ?? today
          updateItem(live.id, { scheduledDate: unit === 'days' ? addDays(base, amount) : snoozeMonths(base, amount) })
          done()
        }}
      />
    )
  }

  if (view === 'icon') {
    return (
      <Sheet title="Icon" onClose={onClose}>
        <IconGrid
          selected={live.icon}
          onPick={(icon) => {
            updateItem(live.id, { icon })
            done()
          }}
          onAuto={async () => {
            const ok = await assignIcon(live)
            if (ok) done()
            return ok
          }}
        />
      </Sheet>
    )
  }

  if (view === 'space') {
    return (
      <Sheet title="Space" onClose={onClose}>
        <div className="flex flex-col">
          {[{ id: null as string | null, name: 'No space', colorHex: 'var(--palette-primary)' }, ...lists].map((l) => (
            <SheetAction
              key={l.id ?? 'none'}
              icon={<span className="w-3 h-3 rounded-full" style={{ background: l.colorHex }} />}
              label={l.name}
              detail={l.id === live.listId ? 'Current' : null}
              onClick={() => {
                updateItem(live.id, { listId: l.id })
                done()
              }}
            />
          ))}
        </div>
      </Sheet>
    )
  }

  if (view === 'delete') {
    return (
      <Sheet title="Delete task?" onClose={onClose}>
        <p className="text-sm text-text-secondary">
          “{live.title}”{items.some((i) => i.parentId === live.id && !i.isDeleted) ? ' and its subtasks' : ''} will be deleted on
          every device.
        </p>
        <div className="flex gap-2 justify-end mt-4">
          <button type="button" className={quietButtonClass} onClick={done}>
            Cancel
          </button>
          <button
            type="button"
            className="px-4 py-2.5 rounded-lg bg-danger-solid hover:bg-danger-solid-hover text-on-danger text-sm font-semibold cursor-pointer"
            onClick={() => {
              deleteItem(live.id)
              onClose()
            }}
          >
            Delete
          </button>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet title={live.title} onClose={onClose}>
      {live.description && <p className="text-sm text-text-muted whitespace-pre-wrap mb-3">{live.description}</p>}
      <div className="flex flex-col">
        <SheetAction icon={<Pencil className="w-4 h-4" />} label="Edit title and notes" onClick={() => setView('edit')} />
        {live.scheduledDate !== today && (
          <SheetAction icon={<Sun className="w-4 h-4" />} label="Do today" onClick={() => (updateItem(live.id, { scheduledDate: today }), onClose())} />
        )}
        <SheetAction
          icon={<CalendarPlus className="w-4 h-4" />}
          label="Tomorrow"
          onClick={() => (updateItem(live.id, { scheduledDate: addDays(live.scheduledDate ?? today, 1) }), onClose())}
        />
        <SheetAction icon={<CalendarDays className="w-4 h-4" />} label="Schedule" detail={live.scheduledDate} onClick={() => setView('schedule')} />
        {live.scheduledDate !== null && (
          <SheetAction icon={<Inbox className="w-4 h-4" />} label="Back to backlog" onClick={() => (updateItem(live.id, { scheduledDate: null }), onClose())} />
        )}
        <SheetAction icon={<AlarmClock className="w-4 h-4" />} label="Snooze for…" onClick={() => setView('snooze')} />
        <SheetAction icon={<Repeat className="w-4 h-4" />} label="Repeat" detail={recurrenceLabel(live.recurrenceRule)} onClick={() => setView('recurrence')} />
        <SheetAction
          icon={<RefreshCw className="w-4 h-4" />}
          label={live.isDaily ? 'Stop repeating daily' : 'Repeat daily at 8:00'}
          onClick={() => updateItem(live.id, live.isDaily ? { isDaily: false } : { isDaily: true, scheduledDate: today, isCompleted: false })}
        />
        <SheetAction
          icon={<Star className={`w-4 h-4 ${live.priority >= 2 ? 'text-priority-high fill-current' : ''}`} />}
          label={live.priority >= 2 ? 'Remove star' : 'Star'}
          onClick={() => updateItem(live.id, { priority: live.priority >= 2 ? 0 : 2 })}
        />
        <SheetAction
          icon={iconLigature(live.icon) ? <span className="material-symbols-rounded text-[18px]">{iconLigature(live.icon)}</span> : <Shapes className="w-4 h-4" />}
          label="Icon"
          detail={live.icon}
          onClick={() => setView('icon')}
        />
        {!isChild && <SheetAction icon={<Tag className="w-4 h-4" />} label="Space" detail={space?.name ?? 'None'} onClick={() => setView('space')} />}
        {!isChild && <SheetAction icon={<ListPlus className="w-4 h-4" />} label="Add subtask" onClick={() => setView('subtask')} />}
        <SheetAction icon={<ArrowUpToLine className="w-4 h-4" />} label="Move to top" onClick={() => (moveItem(live, 'top'), onClose())} />
        <SheetAction icon={<ArrowDownToLine className="w-4 h-4" />} label="Move to bottom" onClick={() => (moveItem(live, 'bottom'), onClose())} />
        <SheetAction icon={<Trash2 className="w-4 h-4" />} label="Delete" danger onClick={() => setView('delete')} />
      </div>
    </Sheet>
  )
}

function EditView({
  item,
  save,
  onDone,
  onClose,
}: {
  item: TodoItem
  save: (patch: Partial<TodoItem>) => void
  onDone: () => void
  onClose: () => void
}) {
  const [title, setTitle] = useState(item.title)
  const [description, setDescription] = useState(item.description ?? '')
  return (
    <Sheet title="Edit task" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          save({ title, description: description.trim() ? description.trim() : null })
          onDone()
        }}
        className="flex flex-col gap-3"
      >
        <PlainTextField label="Title" autoFocus value={title} onChange={setTitle} className={inputClass} />
        <textarea
          aria-label="Notes"
          autoComplete="off"
          placeholder="Notes"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={inputClass}
        />
        <div className="flex gap-2 justify-end">
          <button type="button" className={quietButtonClass} onClick={onDone}>
            Cancel
          </button>
          <button type="submit" className={primaryButtonClass} disabled={!title.trim()}>
            Save
          </button>
        </div>
      </form>
    </Sheet>
  )
}

export function TextPrompt({
  title,
  placeholder,
  submitLabel,
  initial = '',
  onSubmit,
  onClose,
}: {
  title: string
  placeholder: string
  submitLabel: string
  initial?: string
  onSubmit: (value: string) => void
  onClose: () => void
}) {
  const [value, setValue] = useState(initial)
  return (
    <Sheet title={title} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (value.trim()) onSubmit(value)
        }}
        className="flex gap-2"
      >
        <PlainTextField label={placeholder} autoFocus placeholder={placeholder} value={value} onChange={setValue} className={`${inputClass} min-w-0`} />
        <button type="submit" className={primaryButtonClass} disabled={!value.trim()}>
          {submitLabel}
        </button>
      </form>
    </Sheet>
  )
}

function RecurrenceView({
  item,
  save,
  onDone,
  onClose,
}: {
  item: TodoItem
  save: (rule: string | null) => void
  onDone: () => void
  onClose: () => void
}) {
  const [custom, setCustom] = useState('3')
  return (
    <Sheet title="Repeat" onClose={onClose}>
      <div className="flex flex-col">
        {RECURRENCE_OPTIONS.map((option) => (
          <SheetAction
            key={option.label}
            icon={<Repeat className="w-4 h-4" />}
            label={option.label}
            detail={option.rule === item.recurrenceRule ? 'Current' : null}
            onClick={() => {
              save(option.rule)
              onDone()
            }}
          />
        ))}
      </div>
      <form
        className="flex items-center gap-2 mt-3"
        onSubmit={(event) => {
          event.preventDefault()
          save(customDaysRule(parseInt(custom, 10)))
          onDone()
        }}
      >
        <span className="text-sm text-text-secondary shrink-0">Every</span>
        <input aria-label="Days" type="number" min={1} inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value)} className={`${inputClass} w-20`} />
        <span className="text-sm text-text-secondary flex-1">days</span>
        <button type="submit" className={primaryButtonClass}>
          Set
        </button>
      </form>
    </Sheet>
  )
}

function SnoozeView({ onSnooze, onClose }: { onSnooze: (amount: number, unit: 'days' | 'months') => void; onClose: () => void }) {
  const [amount, setAmount] = useState('1')
  const [unit, setUnit] = useState<'days' | 'months'>('days')
  return (
    <Sheet title="Snooze for" onClose={onClose}>
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          onSnooze(Math.max(0, parseInt(amount, 10) || 0), unit)
        }}
      >
        <input aria-label="Amount" type="number" min={0} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${inputClass} w-20`} />
        <select aria-label="Unit" value={unit} onChange={(e) => setUnit(e.target.value as 'days' | 'months')} className={`${inputClass} flex-1`}>
          <option value="days">Days</option>
          <option value="months">Months</option>
        </select>
        <button type="submit" className={primaryButtonClass}>
          Snooze
        </button>
      </form>
    </Sheet>
  )
}

function IconGrid({
  selected,
  onPick,
  onAuto,
}: {
  selected: string | null
  onPick: (icon: string | null) => void
  onAuto: () => Promise<boolean>
}) {
  const [auto, setAuto] = useState<'idle' | 'working' | 'failed'>('idle')
  return (
    <>
      <div className="grid grid-cols-5 gap-2">
        {TODO_ICONS.map((name) => (
          <button
            key={name}
            type="button"
            title={name}
            aria-label={name}
            aria-pressed={selected === name}
            onClick={() => onPick(name)}
            className={`aspect-square flex items-center justify-center rounded-lg border cursor-pointer ${selected === name ? 'border-primary bg-surface-hover' : 'border-line hover:bg-surface-hover'}`}
          >
            <span className="material-symbols-rounded text-[22px] text-text-secondary">{iconLigature(name)}</span>
          </button>
        ))}
      </div>
      <div className="flex gap-2 justify-end mt-4 items-center">
        {auto === 'failed' && <span className="text-xs text-danger flex-1">Couldn't pick one just now.</span>}
        <button type="button" className={quietButtonClass} onClick={() => onPick(null)}>
          None
        </button>
        <button
          type="button"
          className={primaryButtonClass}
          disabled={auto === 'working'}
          onClick={async () => {
            setAuto('working')
            setAuto((await onAuto()) ? 'idle' : 'failed')
          }}
        >
          {auto === 'working' ? 'Picking…' : 'Auto'}
        </button>
      </div>
    </>
  )
}
