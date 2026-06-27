import { useState } from 'react'
import { ChevronLeft, Plus, ChevronUp, ChevronDown, Edit2, Trash2 } from 'lucide-react'
import { useGrocery } from '@/features/grocery/context/GroceryContext'
import { getCategoryColor } from '../config/constants'
import { generateUuid } from '@/utils/uuid'
import type { Category } from '@/types/grocery'
import { cn } from '@/utils/cn'

interface CategoryConfigPanelProps {
  onBack: () => void
  showToast: (msg: string) => void
}

const EMOJI_PRESETS = ['🍎', '🥦', '🍞', '🥩', '🥛', '🍦', '🥫', '🧼', '🍿', '🥤', '🐶', '🧴']

export function CategoryConfigPanel({ onBack, showToast }: CategoryConfigPanelProps) {
  const {
    activeListId,
    categories,
    setCategories,
    handleManualSync
  } = useGrocery()

  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryIcon, setNewCategoryIcon] = useState('')
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editingCategoryName, setEditingCategoryName] = useState('')
  const [editingCategoryIcon, setEditingCategoryIcon] = useState('')

  const triggerSync = () => {
    setTimeout(() => {
      handleManualSync().catch(err => console.error('[Sync] Auto-manual sync error:', err))
    }, 200)
  }

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCategoryName.trim()) return

    const activeCategoriesList = (categories || []).filter(c => c.listId === activeListId && !c.is_deleted)

    const newCategory: Category = {
      id: generateUuid(),
      name: newCategoryName.trim(),
      icon: newCategoryIcon.trim() || undefined,
      position: activeCategoriesList.length + 1,
      listId: activeListId,
      sync_state: 'PENDING_INSERT',
      version: 1,
      is_deleted: false,
    }

    setCategories(prev => [...prev, newCategory])
    setNewCategoryName('')
    setNewCategoryIcon('')
    showToast(`Category "${newCategory.name}" added locally.`)
    triggerSync()
  }

  const handleUpdateCategory = (categoryId: string) => {
    if (!editingCategoryName.trim()) return
    setCategories(prev => prev.map(c => {
      if (c.id !== categoryId) return c
      return {
        ...c,
        name: editingCategoryName.trim(),
        icon: editingCategoryIcon.trim() || undefined,
        sync_state: c.sync_state === 'PENDING_INSERT' ? 'PENDING_INSERT' : 'PENDING_UPDATE',
        version: c.version + 1
      }
    }))
    setEditingCategoryId(null)
    setEditingCategoryName('')
    setEditingCategoryIcon('')
    showToast('Category updated.')
    triggerSync()
  }

  const handleDeleteCategory = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId)
    if (!category) return

    setCategories(prev => prev.map(c => {
      if (c.id !== categoryId) return c
      return {
        ...c,
        is_deleted: true,
        sync_state: 'PENDING_DELETE',
        version: c.version + 1
      }
    }))
    showToast(`Category "${category.name}" removed.`)
    triggerSync()
  }

  const handleMoveCategory = (categoryId: string, direction: 'up' | 'down') => {
    const active = (categories || []).filter(c => c.listId === activeListId && !c.is_deleted).sort((a, b) => a.position - b.position)
    const index = active.findIndex(c => c.id === categoryId)
    if (index === -1) return
    
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === active.length - 1) return
    
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    const current = active[index]
    const other = active[swapIndex]

    setCategories(prev => prev.map(c => {
      if (c.id === current.id) {
        return {
          ...c,
          position: other.position,
          sync_state: c.sync_state === 'PENDING_INSERT' ? 'PENDING_INSERT' : 'PENDING_UPDATE',
          version: c.version + 1
        }
      }
      if (c.id === other.id) {
        return {
          ...c,
          position: current.position,
          sync_state: c.sync_state === 'PENDING_INSERT' ? 'PENDING_INSERT' : 'PENDING_UPDATE',
          version: c.version + 1
        }
      }
      return c
    }))
    triggerSync()
  }

  const activeCategories = (categories || [])
    .filter(c => c.listId === activeListId && !c.is_deleted)
    .sort((a, b) => a.position - b.position)

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-neutral-900 pb-3">
        <button
          onClick={onBack}
          className="p-1.5 hover:bg-neutral-900 rounded-lg text-text-muted hover:text-white transition-colors cursor-pointer"
          aria-label="Back to settings"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h3 className="text-base font-bold text-white">Manage Categories</h3>
          <p className="text-[11px] text-text-muted">Configure active product categories and styling preset icons</p>
        </div>
      </div>

      {/* Add Category Form */}
      <div className="space-y-2">
        <label className="text-[10px] uppercase tracking-wider font-bold text-text-muted px-1 block">
          Add New Category
        </label>
        
        <form onSubmit={handleAddCategory} className="bg-surface-tile border border-neutral-900 rounded-xl p-4 space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Category name..."
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg py-2.5 px-3 text-xs focus:outline-none focus:border-primary text-white"
            />
            <input
              type="text"
              placeholder="Emoji"
              value={newCategoryIcon}
              onChange={(e) => setNewCategoryIcon(e.target.value.slice(0, 2))}
              className="w-16 bg-neutral-900 border border-neutral-800 rounded-lg py-2.5 px-2 text-xs focus:outline-none focus:border-primary text-white text-center font-sans"
            />
          </div>

          {/* Quick Emoji Presets */}
          <div className="space-y-1.5">
            <label className="text-[9px] uppercase tracking-wider text-text-muted font-bold block px-0.5">Quick Icon Presets</label>
            <div className="flex flex-wrap gap-1.5">
              {EMOJI_PRESETS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setNewCategoryIcon(emoji)}
                  className={cn(
                    "w-8 h-8 rounded-lg bg-neutral-900 border text-sm flex items-center justify-center transition-all cursor-pointer hover:bg-neutral-800 active:scale-90",
                    newCategoryIcon === emoji ? "border-primary text-white" : "border-neutral-850 text-neutral-400"
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-primary hover:bg-[#c0a9f5] text-black font-semibold rounded-lg py-2.5 text-xs transition-all active:scale-[0.99] cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" /> Add Category
          </button>
        </form>
      </div>

      {/* Categories List */}
      <div className="space-y-2.5">
        <label className="text-[10px] uppercase tracking-wider font-bold text-text-muted px-1 block">
          Categories List ({activeCategories.length})
        </label>
        
        <div className="bg-surface-tile border border-neutral-900 rounded-xl divide-y divide-neutral-900">
          {activeCategories.length === 0 ? (
            <div className="p-8 text-center text-xs text-text-muted">
              No categories configured. Add a category above to start.
            </div>
          ) : (
            activeCategories.map((category, idx) => {
              const isEditing = editingCategoryId === category.id
              const catColor = getCategoryColor(category.id)
              return (
                <div key={category.id} className="p-3.5 flex flex-col gap-2.5 text-sm transition-colors hover:bg-neutral-900/20 justify-center">
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editingCategoryName}
                          onChange={(e) => setEditingCategoryName(e.target.value)}
                          className="flex-1 bg-black border border-neutral-800 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-primary text-white"
                          placeholder="Name"
                        />
                        <input
                          type="text"
                          value={editingCategoryIcon}
                          onChange={(e) => setEditingCategoryIcon(e.target.value.slice(0, 2))}
                          className="w-16 bg-black border border-neutral-800 rounded-lg px-2.5 py-1 text-xs text-center focus:outline-none focus:border-primary text-white"
                          placeholder="Emoji"
                        />
                      </div>
                      
                      <div className="flex flex-wrap gap-1.5">
                        {EMOJI_PRESETS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => setEditingCategoryIcon(emoji)}
                            className={cn(
                              "w-7 h-7 rounded-md bg-neutral-900 border text-xs flex items-center justify-center transition-all cursor-pointer hover:bg-neutral-800",
                              editingCategoryIcon === emoji ? "border-primary text-white" : "border-neutral-850 text-neutral-400"
                            )}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>

                      <div className="flex justify-end gap-2 pt-1 border-t border-neutral-900">
                        <button
                          onClick={() => handleUpdateCategory(category.id)}
                          className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-md text-xs font-semibold"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingCategoryId(null)
                            setEditingCategoryName('')
                            setEditingCategoryIcon('')
                          }}
                          className="bg-neutral-900 hover:bg-neutral-800 text-text-muted px-3 py-1 rounded-md text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3 w-full">
                      <div className="flex items-center gap-2.5 truncate">
                        <span 
                          className="w-2.5 h-2.5 rounded-full shrink-0" 
                          style={{ backgroundColor: catColor }} 
                        />
                        {category.icon && <span className="text-base shrink-0">{category.icon}</span>}
                        <span className="font-semibold text-white truncate">{category.name}</span>
                      </div>
                      
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleMoveCategory(category.id, 'up')}
                          disabled={idx === 0}
                          className="p-1.5 hover:bg-neutral-900 rounded-md text-text-muted hover:text-white disabled:opacity-20 disabled:pointer-events-none cursor-pointer"
                          aria-label="Move category up"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveCategory(category.id, 'down')}
                          disabled={idx === activeCategories.length - 1}
                          className="p-1.5 hover:bg-neutral-900 rounded-md text-text-muted hover:text-white disabled:opacity-20 disabled:pointer-events-none cursor-pointer"
                          aria-label="Move category down"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setEditingCategoryId(category.id)
                            setEditingCategoryName(category.name)
                            setEditingCategoryIcon(category.icon || '')
                          }}
                          className="p-1.5 hover:bg-neutral-900 rounded-md text-text-muted hover:text-white cursor-pointer"
                          aria-label="Edit category"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(category.id)}
                          className="p-1.5 hover:bg-red-500/10 rounded-md text-neutral-500 hover:text-red-400 cursor-pointer"
                          aria-label="Delete category"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
