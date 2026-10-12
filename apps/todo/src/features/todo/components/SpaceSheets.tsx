import { useState } from 'react'
import { ArrowDown, ArrowUp, Check } from 'lucide-react'
import type { TodoList } from '../types'
import { useTodo } from '../TodoContext'
import { SPACE_SWATCHES } from '../swatches'
import { Sheet, inputClass, primaryButtonClass, quietButtonClass } from './Sheet'

/** Add a space, or edit or delete one (`TodoDialogs.kt`). */
export function SpaceSheet({ space, onClose }: { space: TodoList | null; onClose: () => void }) {
  const { addList, updateList, deleteList } = useTodo()
  const [name, setName] = useState(space?.name ?? '')
  const [color, setColor] = useState<string>(space?.colorHex ?? SPACE_SWATCHES[0])
  const [confirming, setConfirming] = useState(false)

  if (space && confirming) {
    return (
      <Sheet title={`Delete ${space.name}?`} onClose={onClose}>
        <p className="text-sm text-text-secondary">Its tasks stay, with no space.</p>
        <div className="flex gap-2 justify-end mt-4">
          <button type="button" className={quietButtonClass} onClick={() => setConfirming(false)}>
            Cancel
          </button>
          <button
            type="button"
            className="px-4 py-2.5 rounded-lg bg-danger-solid hover:bg-danger-solid-hover text-on-danger text-sm font-semibold cursor-pointer"
            onClick={() => {
              deleteList(space.id)
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
    <Sheet title={space ? 'Edit space' : 'New space'} onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (!name.trim()) return
          if (space) updateList(space.id, { name, colorHex: color })
          else addList(name, color)
          onClose()
        }}
      >
        {/* "Name" alone reads to Chrome as a person's name, and it pins its autofill bar over the
            keyboard's suggestions -- and over this sheet's buttons. */}
        <input
          aria-label="Space name"
          autoFocus
          autoComplete="off"
          placeholder="Space name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
        <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Colour">
          {SPACE_SWATCHES.map((swatch) => (
            <button
              key={swatch}
              type="button"
              role="radio"
              aria-checked={color === swatch}
              aria-label={swatch}
              // Leaves focus in the name field: a tap here would otherwise drop the keyboard,
              // and the sheet with it, halfway through naming the space.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setColor(swatch)}
              className="hex w-9 h-9 flex items-center justify-center cursor-pointer"
              style={{ background: swatch }}
            >
              {color === swatch && <Check className="w-4 h-4 text-on-primary" />}
            </button>
          ))}
        </div>
        <div className="flex gap-2 justify-end">
          {space && (
            <button type="button" className={`${quietButtonClass} text-danger mr-auto`} onClick={() => setConfirming(true)}>
              Delete
            </button>
          )}
          <button type="button" className={quietButtonClass} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={primaryButtonClass} disabled={!name.trim()}>
            Save
          </button>
        </div>
      </form>
    </Sheet>
  )
}

/** The space order, which stays on this device as it does on Android. */
export function ReorderSpacesSheet({ onClose }: { onClose: () => void }) {
  const { lists, reorderLists } = useTodo()
  const ids = lists.map((l) => l.id)
  const swap = (index: number, other: number) => {
    const next = [...ids]
    ;[next[index], next[other]] = [next[other], next[index]]
    reorderLists(next)
  }
  return (
    <Sheet title="Reorder spaces" onClose={onClose}>
      <ul className="flex flex-col gap-1">
        {lists.map((l, index) => (
          <li key={l.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-inset">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: l.colorHex }} />
            <span className="flex-1 text-sm text-text-primary truncate">{l.name}</span>
            <button type="button" aria-label={`Move ${l.name} up`} disabled={index === 0} onClick={() => swap(index, index - 1)} className="p-2 text-text-muted disabled:opacity-30 cursor-pointer">
              <ArrowUp className="w-4 h-4" />
            </button>
            <button
              type="button"
              aria-label={`Move ${l.name} down`}
              disabled={index === lists.length - 1}
              onClick={() => swap(index, index + 1)}
              className="p-2 text-text-muted disabled:opacity-30 cursor-pointer"
            >
              <ArrowDown className="w-4 h-4" />
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}
