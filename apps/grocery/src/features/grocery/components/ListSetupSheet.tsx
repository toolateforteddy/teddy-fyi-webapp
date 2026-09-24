import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { MapPin, Plus, Sparkles, X } from 'lucide-react'
import { useGrocery } from '@/features/grocery/context/GroceryContext'
import { cn } from '@/utils/cn'
import {
  STARTER_CATEGORIES,
  buildStarterCategories,
  buildStores,
  listSetupNeeds,
} from '../utils/listSetup'

interface ListSetupSheetProps {
  isOpen: boolean
  onClose: () => void
  listId: string
  listName: string
}

/**
 * The two questions a list with nothing configured needs answered before it is
 * useful: where you shop, and whether to start from the recommended categories.
 *
 * Each question is shown only when the list is missing that half, decided when
 * the sheet opens rather than live, so a store synced in from another device
 * while the sheet is up does not pull a section out from under the person typing
 * in it. Everything here is also reachable from Settings, which is where the
 * copy sends anyone who wants to change it later.
 */
export function ListSetupSheet({ isOpen, onClose, listId, listName }: ListSetupSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const { stores, setStores, categories, setCategories, handleManualSync } = useGrocery()

  const [asks, setAsks] = useState({ needsStores: false, needsCategories: false })
  const [storeNames, setStoreNames] = useState<string[]>([])
  const [storeDraft, setStoreDraft] = useState('')
  const [addStarters, setAddStarters] = useState(true)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen) {
      if (!dialog.open) {
        setAsks(listSetupNeeds(listId, stores, categories))
        setStoreNames([])
        setStoreDraft('')
        setAddStarters(true)
        dialog.showModal()
      }
    } else if (dialog.open) {
      dialog.close()
    }
    // Snapshot on open only; see the doc comment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const queueStore = (e: FormEvent) => {
    e.preventDefault()
    const name = storeDraft.trim()
    if (!name) return
    if (!storeNames.some(n => n.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setStoreNames(prev => [...prev, name])
    }
    setStoreDraft('')
  }

  // A name still sitting in the box counts: "type it and press Done" is how most
  // people will answer a one-field question, and dropping it would be a lie.
  const pendingStoreNames = asks.needsStores ? [...storeNames, storeDraft] : []
  const newStores = buildStores(listId, pendingStoreNames, stores)
  const newCategories = asks.needsCategories && addStarters ? buildStarterCategories(listId, categories) : []
  const hasWork = newStores.length > 0 || newCategories.length > 0

  const finish = () => {
    if (newStores.length > 0) setStores(prev => [...prev, ...newStores])
    if (newCategories.length > 0) setCategories(prev => [...prev, ...newCategories])
    if (hasWork) {
      setTimeout(() => {
        handleManualSync().catch(err => console.error('[Sync] Auto-manual sync error:', err))
      }, 200)
    }
    onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="list-setup-title"
      className="app-frame fixed top-auto bottom-0 left-1/2 -translate-x-1/2 max-h-[85dvh] overflow-y-auto overscroll-contain bg-surface-tile border-t border-line rounded-t-2xl z-50 px-4 pt-4 pb-[calc(2rem+env(safe-area-inset-bottom))] shadow-2xl backdrop:bg-scrim/60 backdrop:backdrop-blur-sm animate-in slide-in-from-bottom duration-250 ease-out focus:outline-none"
    >
      <div className="flex items-center justify-between mb-4 border-b border-line pb-3">
        <div className="flex items-center gap-1.5 min-w-0">
          <Sparkles className="w-4 h-4 text-primary shrink-0" />
          <h3 id="list-setup-title" className="font-semibold text-text-primary truncate">
            Set up {listName}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="p-1 text-text-muted hover:text-text-primary rounded-md cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-6">
        {asks.needsStores && (
          <section className="space-y-2.5">
            <div>
              <h4 className="text-sm font-semibold text-text-primary">Where do you usually shop?</h4>
              <p className="text-xs text-text-muted">
                Add at least one store you typically shop at. Shopping mode works one store at a time.
              </p>
            </div>

            <form onSubmit={queueStore} className="flex gap-2">
              <input
                type="text"
                aria-label="Store name"
                placeholder="e.g. Trader Joe's"
                value={storeDraft}
                onChange={e => setStoreDraft(e.target.value)}
                className="flex-1 min-w-0 bg-surface-raised border border-line rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:border-primary text-text-primary placeholder:text-text-faint"
              />
              <button
                type="submit"
                disabled={!storeDraft.trim()}
                className="px-3.5 bg-surface-raised border border-line hover:border-line-strong text-text-primary text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </form>

            {storeNames.length > 0 && (
              <ul className="flex flex-wrap gap-2" aria-label="Stores to add">
                {storeNames.map(name => (
                  <li
                    key={name}
                    className="flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-full border border-line bg-surface-raised text-xs font-semibold text-text-primary"
                  >
                    <MapPin className="w-3.5 h-3.5 text-primary" />
                    {name}
                    <button
                      type="button"
                      onClick={() => setStoreNames(prev => prev.filter(n => n !== name))}
                      aria-label={`Remove ${name}`}
                      className="p-0.5 rounded-full text-text-muted hover:text-text-primary cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {asks.needsCategories && (
          <section className="space-y-2.5">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={addStarters}
                onChange={e => setAddStarters(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-primary cursor-pointer"
              />
              <span>
                <span className="block text-sm font-semibold text-text-primary">
                  Start with recommended categories
                </span>
                <span className="block text-xs text-text-muted">
                  Items group by category while you shop. Rename, reorder or remove them any time in Settings.
                </span>
              </span>
            </label>

            <ul
              aria-label="Recommended categories"
              className={cn('flex flex-wrap gap-1.5 pl-7 transition-opacity', !addStarters && 'opacity-40')}
            >
              {STARTER_CATEGORIES.map(c => (
                <li
                  key={c.name}
                  className="px-2.5 py-1 rounded-full border border-line-faint bg-surface-raised text-xs text-text-secondary"
                >
                  <span aria-hidden="true">{c.icon}</span> {c.name}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 bg-surface-raised border border-line hover:border-line-strong hover:text-text-primary text-xs font-semibold rounded-lg text-text-muted active:scale-95 transition-all cursor-pointer"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={finish}
            disabled={!hasWork}
            className="flex-1 py-2.5 px-4 bg-primary hover:bg-primary-hover text-on-primary font-semibold rounded-lg text-xs active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Set up list
          </button>
        </div>
      </div>
    </dialog>
  )
}
