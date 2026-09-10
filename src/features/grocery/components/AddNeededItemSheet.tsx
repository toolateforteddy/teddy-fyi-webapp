import { useState, useEffect, useRef } from 'react'
import type { FormEvent } from 'react'
import { Sparkles, X, Plus } from 'lucide-react'

const SUGGESTIONS = [
  'Apples', 'Almond Milk', 'Butter', 'Broccoli', 'Blueberries',
  'Chicken Breast', 'Cheddar Cheese', 'Eggs', 'Garlic', 'Hummus',
  'Lemon', 'Olive Oil', 'Onions', 'Pasta', 'Rice', 'Spinach',
  'Strawberries', 'Tomatoes', 'Tortillas', 'Water'
]

interface AddNeededItemSheetProps {
  isOpen: boolean
  onClose: () => void
  activeCategories: Array<{ id: string | number; name: string; color: string; icon?: string }>
  onAddItem: (name: string, quantity: string, categoryId: string | undefined) => void
}

export function AddNeededItemSheet({ isOpen, onClose, activeCategories, onAddItem }: AddNeededItemSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [newItemName, setNewItemName] = useState('')
  const [newItemQuantity, setNewItemQuantity] = useState('1')
  const [newItemCategory, setNewItemCategory] = useState<string | undefined>(undefined)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal()
        setNewItemName('')
        setNewItemQuantity('1')
        setNewItemCategory(undefined)
      }
    } else {
      if (dialog.open) {
        dialog.close()
      }
    }
  }, [isOpen])

  // Filter autocomplete suggestions
  const query = newItemName.trim().toLowerCase()
  const filteredSuggestions = query
    ? SUGGESTIONS.filter(
        s => s.toLowerCase().includes(query) && s.toLowerCase() !== query
      ).slice(0, 4)
    : []

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!newItemName.trim()) return

    onAddItem(newItemName.trim(), newItemQuantity, newItemCategory)
    onClose()
  }

  // top-auto and max-w-none override the <dialog> UA styles (inset: 0 and
  // max-width: calc(100% - padding)), which otherwise pin this sheet to the top
  // edge at less than full width. Tailwind's preflight resets the UA margin: auto.
  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="app-frame fixed top-auto bottom-0 left-1/2 -translate-x-1/2 max-h-[85dvh] overflow-y-auto overscroll-contain bg-surface-tile border-t border-neutral-800 rounded-t-2xl z-50 px-4 pt-4 pb-[calc(2rem+env(safe-area-inset-bottom))] shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm animate-in slide-in-from-bottom duration-250 ease-out focus:outline-none"
    >
      <div className="flex items-center justify-between mb-4 border-b border-neutral-800 pb-3">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-white">Add Needed Item</h3>
        </div>
        <button 
          onClick={onClose}
          className="p-1 text-text-muted hover:text-white rounded-md cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Input name */}
        <div>
          <label htmlFor="item-name" className="sr-only">Item Name</label>
          <input
            id="item-name"
            type="text"
            placeholder="What is needed? (e.g. Milk, Eggs)"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            autoFocus
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={filteredSuggestions.length > 0}
            aria-controls={filteredSuggestions.length > 0 ? "suggestions-listbox" : undefined}
            className="w-full bg-black/40 border border-neutral-800 rounded-lg py-2.5 px-3.5 text-sm focus:outline-none focus:border-primary transition-colors text-white placeholder-neutral-600"
          />
        </div>

        {/* Suggestion Chips */}
        {filteredSuggestions.length > 0 && (
          <div 
            id="suggestions-listbox"
            role="listbox"
            aria-label="Autocomplete suggestions"
            className="flex flex-wrap gap-1.5 animate-in fade-in duration-150"
          >
            {filteredSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                role="option"
                aria-selected="false"
                onClick={() => setNewItemName(suggestion)}
                className="text-xs bg-neutral-900 border border-neutral-800 hover:border-primary text-text-muted hover:text-primary rounded-full px-3 py-1 transition-all cursor-pointer"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {/* Quantity and Category Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider font-bold text-text-muted block mb-1">
              Quantity
            </label>
            <input
              type="text"
              value={newItemQuantity}
              onChange={(e) => setNewItemQuantity(e.target.value)}
              className="w-full bg-black/40 border border-neutral-800 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-primary text-white"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider font-bold text-text-muted block mb-1">
              Category
            </label>
            <select
              value={newItemCategory ?? ''}
              onChange={(e) => setNewItemCategory(e.target.value ? e.target.value : undefined)}
              className="w-full bg-black/40 border border-neutral-800 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-primary text-white cursor-pointer"
            >
              <option value="" className="bg-surface-tile text-white">
                Uncategorized
              </option>
              {activeCategories.map(cat => (
                <option key={cat.id} value={cat.id} className="bg-surface-tile text-white">
                  {cat.icon ? `${cat.icon} ${cat.name}` : cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="w-full bg-primary hover:bg-[#c0a9f5] text-black font-semibold rounded-lg py-2.5 mt-2 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-1.5 text-sm"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          Add Item
        </button>
      </form>
    </dialog>
  )
}
