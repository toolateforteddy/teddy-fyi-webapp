import { useRef, useState, type ReactNode } from 'react'
import { CalendarDays, ListPlus, Repeat, Shapes, Star, Tag, Trash2 } from 'lucide-react'
import type { TodoItem } from '../types'
import { useTodo } from '../TodoContext'
import { TODO_ICONS, iconLigature } from '../icons'
import { RECURRENCE_OPTIONS, addDays, customDaysRule, dayLabel, recurrenceLabel, todayIso } from '../rules'
import { Sheet, SheetAction, inputClass, primaryButtonClass, quietButtonClass } from './Sheet'
import { PlainTextField } from './PlainTextField'

/**
 * Everything a task can have done to it, on one sheet: its title and notes, edited in place,
 * then when it is for, how it repeats, its space, its icon, its subtasks, and Delete. Only the
 * icon grid and the delete confirmation take the sheet over; everything else is a control on
 * it, so what a task is set to and how to change it are the same thing on screen.
 */
export function ItemSheet({ item, onClose }: { item: TodoItem; onClose: () => void }) {
  const { items, lists, updateItem, deleteItem, addItem, assignIcon } = useTodo()
  const [view, setView] = useState<'main' | 'icon' | 'delete'>('main')
  // The sheet is opened on a snapshot; read the live row so every control shows each change.
  const live = items.find((i) => i.id === item.id && !i.isDeleted) ?? item
  const subtasks = items.filter((i) => i.parentId === live.id && !i.isDeleted).sort((a, b) => a.position - b.position)
  const isChild = live.parentId !== null

  // Title and notes are saved when they lose focus and when the sheet closes, so typing is
  // never a burst of edits to sync. An emptied title keeps the old one.
  const [title, setTitle] = useState(live.title)
  const [notes, setNotes] = useState(live.description ?? '')
  const saved = useRef({ title: live.title, notes: live.description ?? '' })
  const save = () => {
    const patch: Partial<TodoItem> = {}
    if (title.trim() && title !== saved.current.title) patch.title = title
    if (notes !== saved.current.notes) patch.description = notes.trim() ? notes.trim() : null
    if (Object.keys(patch).length === 0) return
    saved.current = { title, notes }
    updateItem(live.id, patch)
  }
  // A subtask typed but not yet entered is filed when the sheet closes, not dropped.
  const [subtask, setSubtask] = useState('')
  const addSubtask = () => {
    if (!subtask.trim()) return
    addItem(subtask, { parentId: live.id })
    setSubtask('')
  }
  const close = () => {
    save()
    addSubtask()
    onClose()
  }

  if (view === 'icon') {
    return (
      <Sheet title="Icon" onClose={close}>
        <IconGrid
          selected={live.icon}
          onPick={(icon) => {
            updateItem(live.id, { icon })
            setView('main')
          }}
          onAuto={async () => {
            const ok = await assignIcon(live)
            if (ok) setView('main')
            return ok
          }}
        />
      </Sheet>
    )
  }

  if (view === 'delete') {
    return (
      <Sheet title="Delete task?" onClose={close}>
        <p className="text-sm text-text-secondary">
          “{live.title}”{subtasks.length > 0 ? ' and its subtasks' : ''} will be deleted on every device.
        </p>
        <div className="flex gap-2 justify-end mt-4">
          <button type="button" className={quietButtonClass} onClick={() => setView('main')}>
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

  const starred = live.priority >= 2
  const icon = iconLigature(live.icon)

  return (
    <Sheet
      title={live.title}
      onClose={close}
      header={
        <form
          className="flex-1 min-w-0 flex items-center gap-1"
          onSubmit={(event) => {
            event.preventDefault()
            save()
          }}
        >
          <PlainTextField
            label="Title"
            value={title}
            onChange={setTitle}
            onBlur={save}
            className="flex-1 min-w-0 bg-transparent outline-none text-base font-bold text-text-primary py-1"
          />
          <button
            type="button"
            aria-label={starred ? 'Remove star' : 'Star'}
            aria-pressed={starred}
            onClick={() => updateItem(live.id, { priority: starred ? 0 : 2 })}
            className="p-2 cursor-pointer"
          >
            <Star className={`w-5 h-5 ${starred ? 'text-priority-high fill-current' : 'text-text-faint hover:text-text-primary'}`} />
          </button>
        </form>
      }
    >
      <textarea
        aria-label="Notes"
        autoComplete="off"
        placeholder="Notes"
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={save}
        className={`${inputClass} resize-none mb-3`}
      />

      <div className="flex flex-col">
        <Row icon={<CalendarDays className="w-4 h-4" />}>
          <WhenPicker item={live} onChange={(scheduledDate) => updateItem(live.id, { scheduledDate })} />
        </Row>
        <Row icon={<Repeat className="w-4 h-4" />}>
          <RepeatPicker item={live} onChange={(patch) => updateItem(live.id, patch)} />
        </Row>
        {!isChild && (
          <Row icon={<Tag className="w-4 h-4" />}>
            <select
              aria-label="Space"
              value={live.listId ?? ''}
              onChange={(e) => updateItem(live.id, { listId: e.target.value || null })}
              className={selectClass}
            >
              <option value="">No space</option>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Row>
        )}
        <SheetAction
          icon={icon ? <span className="material-symbols-rounded text-[18px]">{icon}</span> : <Shapes className="w-4 h-4" />}
          label="Icon"
          onClick={() => {
            save()
            setView('icon')
          }}
        />
      </div>

      {!isChild && <Subtasks subtasks={subtasks} value={subtask} onChange={setSubtask} onAdd={addSubtask} />}

      <div className="mt-2">
        <SheetAction
          icon={<Trash2 className="w-4 h-4" />}
          label="Delete"
          danger
          onClick={() => {
            save()
            setView('delete')
          }}
        />
      </div>
    </Sheet>
  )
}

const selectClass =
  'w-full bg-transparent outline-none text-sm font-medium text-text-primary py-3 cursor-pointer appearance-none [&>option]:bg-surface-raised'

/** A sheet row whose right-hand side is a control rather than a label. */
function Row({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-3 rounded-lg hover:bg-surface-hover">
      <span className="w-5 h-5 flex items-center justify-center shrink-0 text-text-primary">{icon}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

/**
 * When the task is for: today, tomorrow, any other day, or the backlog. The one that holds is
 * pressed, so the row is both the setting and the way to change it.
 */
function WhenPicker({ item, onChange }: { item: TodoItem; onChange: (scheduledDate: string | null) => void }) {
  const today = todayIso()
  const tomorrow = addDays(today, 1)
  const date = item.scheduledDate
  const other = date !== null && date !== today && date !== tomorrow
  const chip = (pressed: boolean) =>
    `flex-auto min-w-0 truncate text-center px-2.5 py-1.5 rounded-full border text-xs font-semibold cursor-pointer ${pressed ? 'border-primary bg-surface-hover-strong text-text-primary' : 'border-line text-text-secondary hover:bg-surface-hover'}`
  return (
    <div className="flex gap-1.5 py-2" role="group" aria-label="When">
      <button type="button" aria-pressed={date === today} className={chip(date === today)} onClick={() => onChange(today)}>
        Today
      </button>
      <button type="button" aria-pressed={date === tomorrow} className={chip(date === tomorrow)} onClick={() => onChange(tomorrow)}>
        Tomorrow
      </button>
      <label className={`relative ${chip(other)}`}>
        {other ? dayLabel(date) : 'Date'}
        <input
          type="date"
          aria-label="Pick a date"
          value={date ?? ''}
          min={today}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
      </label>
      <button type="button" aria-pressed={date === null} className={chip(date === null)} onClick={() => onChange(null)}>
        Backlog
      </button>
    </div>
  )
}

const DAILY_AT_8 = 'daily-8'
const CUSTOM = 'custom'

/**
 * How the task repeats, as one choice. The data keeps two settings, `isDaily` (re-armed for
 * today at 08:00) and `recurrenceRule` (comes back after it is done), and Android shows them
 * as two; picking one here clears the other.
 */
function RepeatPicker({ item, onChange }: { item: TodoItem; onChange: (patch: Partial<TodoItem>) => void }) {
  const rule = item.recurrenceRule
  const preset = RECURRENCE_OPTIONS.find((o) => o.rule === rule)
  const customDays = rule?.match(/^FREQ=DAILY;INTERVAL=(\d+)$/)?.[1]
  // A rule this picker cannot make (another client's) still shows as itself, and stays.
  const foreign = rule !== null && !preset && !customDays
  const value = item.isDaily ? DAILY_AT_8 : preset ? (preset.rule ?? '') : foreign ? rule : CUSTOM
  const [days, setDays] = useState(customDays ?? '3')
  return (
    <div className="flex items-center gap-2">
      <select
        aria-label="Repeat"
        value={value}
        onChange={(e) => {
          const next = e.target.value
          if (next === DAILY_AT_8) onChange({ isDaily: true, recurrenceRule: null, scheduledDate: todayIso(), isCompleted: false })
          else if (next === CUSTOM) onChange({ isDaily: false, recurrenceRule: customDaysRule(parseInt(days, 10)) })
          else onChange({ isDaily: false, recurrenceRule: next || null })
        }}
        className={selectClass}
      >
        {RECURRENCE_OPTIONS.map((o) => (
          <option key={o.label} value={o.rule ?? ''}>
            {o.rule === null ? "Doesn't repeat" : recurrenceLabel(o.rule)}
          </option>
        ))}
        <option value={DAILY_AT_8}>Daily at 8:00</option>
        {foreign && <option value={rule}>{recurrenceLabel(rule)}</option>}
        <option value={CUSTOM}>Every few days</option>
      </select>
      {value === CUSTOM && (
        <input
          aria-label="Days between"
          type="number"
          min={1}
          inputMode="numeric"
          value={days}
          onChange={(e) => {
            setDays(e.target.value)
            const n = parseInt(e.target.value, 10)
            if (n > 0) onChange({ recurrenceRule: customDaysRule(n) })
          }}
          className={`${inputClass} w-20 shrink-0`}
        />
      )}
    </div>
  )
}

/**
 * A parent's subtasks, and a field that adds the next one. Enter files it and clears the
 * field with the keyboard still up, so several can go in one after another.
 */
function Subtasks({
  subtasks,
  value,
  onChange,
  onAdd,
}: {
  subtasks: TodoItem[]
  value: string
  onChange: (value: string) => void
  onAdd: () => void
}) {
  return (
    <div className="mt-2 flex flex-col gap-1">
      {subtasks.length > 0 && (
        <ul className="flex flex-col gap-1" aria-label="Subtasks">
          {subtasks.map((subtask) => (
            <li key={subtask.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-inset text-sm text-text-secondary">
              <span className="w-5 flex justify-center shrink-0">
                <span className={`hex w-3 h-3 ${subtask.isCompleted ? 'bg-primary' : 'bg-line-strong'}`} />
              </span>
              <span className={`truncate ${subtask.isCompleted ? 'line-through text-text-muted' : ''}`}>{subtask.title}</span>
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex items-center gap-3 px-3"
        onSubmit={(event) => {
          event.preventDefault()
          onAdd()
        }}
      >
        <span className="w-5 h-5 flex items-center justify-center shrink-0 text-text-primary">
          <ListPlus className="w-4 h-4" />
        </span>
        <PlainTextField
          label="Add subtask"
          placeholder="Add subtask"
          enterKeyHint="enter"
          value={value}
          onChange={onChange}
          className="flex-1 min-w-0 bg-transparent outline-none text-sm font-medium py-3 text-text-primary"
        />
      </form>
    </div>
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
