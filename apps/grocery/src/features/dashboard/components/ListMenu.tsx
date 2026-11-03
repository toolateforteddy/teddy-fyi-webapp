import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Check, ChevronDown, Pencil, Plus, Share2, Trash2, UserPlus } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { rowUserId } from '@/features/auth/utils/identity'
import { useGrocery } from '@/features/grocery/context/GroceryContext'
import { deleteList, newList, renameList } from '@/features/grocery/utils/lists'
import { sortLists } from '@/features/grocery/utils/sort'

interface ListMenuProps {
  onShare: () => void
  onJoin: () => void
}

type Mode = 'menu' | 'new' | 'rename'

/**
 * The header's title, which is also the one place lists are managed: tap the list's name
 * for every list, and for new, rename, share, join and delete. It replaced a pencil that
 * toggled an edit panel, which was a mode to get into and back out of for what is a menu.
 */
export function ListMenu({ onShare, onJoin }: ListMenuProps) {
  const { user } = useAuth()
  const { lists, setLists, activeList, setActiveListId } = useGrocery()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('menu')
  const [draft, setDraft] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  const liveLists = lists
    .filter(l => !l.is_deleted)
    .sort((a, b) => a.name.localeCompare(b.name))

  const close = () => {
    setOpen(false)
    setMode('menu')
  }

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!activeList) return null

  const startNaming = (next: Mode) => {
    setDraft(next === 'rename' ? activeList.name : '')
    setMode(next)
  }

  const submitName = (e: FormEvent) => {
    e.preventDefault()
    const name = draft.trim()
    if (!name) return
    if (mode === 'new') {
      const list = newList(name, rowUserId(user))
      setLists(prev => sortLists([...prev, list]))
      setActiveListId(list.id)
    } else {
      setLists(prev => renameList(prev, activeList.id, name))
    }
    close()
  }

  const removeActive = () => {
    if (!window.confirm(`Delete ${activeList.name}?`)) return
    const next = liveLists.find(l => l.id !== activeList.id)
    setLists(prev => deleteList(prev, activeList.id))
    if (next) setActiveListId(next.id)
    close()
  }

  const action = (onClick: () => void) => () => {
    close()
    onClick()
  }

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1">
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1 min-w-0 max-w-full rounded-lg -ml-1 px-1 py-0.5 hover:bg-surface-hover cursor-pointer"
      >
        <h1 className="min-w-0 text-base font-bold text-text-primary truncate">{activeList.name}</h1>
        <ChevronDown
          className={cn('w-4 h-4 text-text-muted shrink-0 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Lists"
          className="absolute left-0 top-full mt-2 w-64 max-w-[calc(100vw-2rem)] bg-surface-tile border border-line rounded-xl shadow-lg z-50 py-1 animate-in fade-in duration-100"
        >
          {mode === 'menu' ? (
            <>
              {liveLists.map(list => (
                <MenuRow
                  key={list.id}
                  role="menuitemradio"
                  checked={list.id === activeList.id}
                  onClick={() => {
                    setActiveListId(list.id)
                    close()
                  }}
                >
                  <span className="flex-1 truncate">{list.name}</span>
                  {list.id === activeList.id && <Check className="w-4 h-4 text-primary shrink-0" />}
                </MenuRow>
              ))}

              <div className="my-1 border-t border-line-faint" />

              <MenuRow onClick={() => startNaming('new')}>
                <Plus className="w-4 h-4 text-text-muted shrink-0" />
                New list
              </MenuRow>
              <MenuRow onClick={() => startNaming('rename')}>
                <Pencil className="w-4 h-4 text-text-muted shrink-0" />
                Rename
              </MenuRow>
              <MenuRow onClick={action(onShare)}>
                <Share2 className="w-4 h-4 text-text-muted shrink-0" />
                Share
              </MenuRow>
              <MenuRow onClick={action(onJoin)}>
                <UserPlus className="w-4 h-4 text-text-muted shrink-0" />
                Join a list
              </MenuRow>
              {/* The last list cannot go: the app always has one to show. */}
              {liveLists.length > 1 && (
                <MenuRow onClick={removeActive} danger>
                  <Trash2 className="w-4 h-4 shrink-0" />
                  Delete
                </MenuRow>
              )}
            </>
          ) : (
            <form onSubmit={submitName} className="flex items-center gap-2 p-2">
              <input
                autoFocus
                value={draft}
                onChange={e => setDraft(e.target.value)}
                aria-label={mode === 'new' ? 'New list name' : 'List name'}
                placeholder="List name"
                className="flex-1 min-w-0 bg-inset border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary text-text-primary"
              />
              <button
                type="submit"
                disabled={!draft.trim()}
                className="px-3 py-2 rounded-lg bg-primary text-on-primary text-xs font-semibold disabled:opacity-50 cursor-pointer"
              >
                {mode === 'new' ? 'Add' : 'Save'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}

function MenuRow({
  children,
  onClick,
  danger = false,
  role = 'menuitem',
  checked,
}: {
  children: React.ReactNode
  onClick: () => void
  danger?: boolean
  role?: 'menuitem' | 'menuitemradio'
  checked?: boolean
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={role === 'menuitemradio' ? checked : undefined}
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 h-10 text-sm text-left hover:bg-surface-hover cursor-pointer',
        danger ? 'text-danger' : 'text-text-primary'
      )}
    >
      {children}
    </button>
  )
}
