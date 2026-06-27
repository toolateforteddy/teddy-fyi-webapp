import { useState } from 'react'
import { ChevronLeft, Plus, MapPin, ChevronUp, ChevronDown, Edit2, Trash2 } from 'lucide-react'
import { useGrocery } from '@/features/grocery/context/GroceryContext'
import type { Store } from '@/types/grocery'

interface StoreConfigPanelProps {
  onBack: () => void
  showToast: (msg: string) => void
}

const generateUniqueId = (): number => Date.now()

export function StoreConfigPanel({ onBack, showToast }: StoreConfigPanelProps) {
  const {
    activeListId,
    stores,
    setStores,
    handleManualSync
  } = useGrocery()

  const [newStoreName, setNewStoreName] = useState('')
  const [editingStoreId, setEditingStoreId] = useState<number | null>(null)
  const [editingStoreName, setEditingStoreName] = useState('')

  const triggerSync = () => {
    setTimeout(() => {
      handleManualSync().catch(err => console.error('[Sync] Auto-manual sync error:', err))
    }, 200)
  }

  const handleAddStore = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newStoreName.trim()) return

    const activeStoresList = (stores || []).filter(s => s.listId === activeListId && !s.is_deleted)

    const newStore: Store = {
      id: generateUniqueId(),
      name: newStoreName.trim(),
      position: activeStoresList.length + 1,
      isDefaultSupported: false,
      listId: activeListId,
      sync_state: 'PENDING_INSERT',
      version: 1,
      is_deleted: false,
    }

    setStores(prev => [...prev, newStore])
    setNewStoreName('')
    showToast(`Store "${newStore.name}" added locally.`)
    triggerSync()
  }

  const handleUpdateStoreName = (storeId: number) => {
    if (!editingStoreName.trim()) return
    setStores(prev => prev.map(s => {
      if (s.id !== storeId) return s
      return {
        ...s,
        name: editingStoreName.trim(),
        sync_state: s.sync_state === 'PENDING_INSERT' ? 'PENDING_INSERT' : 'PENDING_UPDATE',
        version: s.version + 1
      }
    }))
    setEditingStoreId(null)
    setEditingStoreName('')
    showToast('Store name updated.')
    triggerSync()
  }

  const handleDeleteStore = (storeId: number) => {
    const store = stores.find(s => s.id === storeId)
    if (!store) return

    setStores(prev => prev.map(s => {
      if (s.id !== storeId) return s
      return {
        ...s,
        is_deleted: true,
        sync_state: 'PENDING_DELETE',
        version: s.version + 1
      }
    }))
    showToast(`Store "${store.name}" removed.`)
    triggerSync()
  }

  const handleMoveStore = (storeId: number, direction: 'up' | 'down') => {
    const active = (stores || []).filter(s => s.listId === activeListId && !s.is_deleted).sort((a, b) => a.position - b.position)
    const index = active.findIndex(s => s.id === storeId)
    if (index === -1) return
    
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === active.length - 1) return
    
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    const current = active[index]
    const other = active[swapIndex]

    setStores(prev => prev.map(s => {
      if (s.id === current.id) {
        return {
          ...s,
          position: other.position,
          sync_state: s.sync_state === 'PENDING_INSERT' ? 'PENDING_INSERT' : 'PENDING_UPDATE',
          version: s.version + 1
        }
      }
      if (s.id === other.id) {
        return {
          ...s,
          position: current.position,
          sync_state: s.sync_state === 'PENDING_INSERT' ? 'PENDING_INSERT' : 'PENDING_UPDATE',
          version: s.version + 1
        }
      }
      return s
    }))
    triggerSync()
  }

  const activeStores = (stores || [])
    .filter(s => s.listId === activeListId && !s.is_deleted)
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
          <h3 className="text-base font-bold text-white">Manage Stores</h3>
          <p className="text-[11px] text-text-muted">Configure active stores for filtering grocery lists</p>
        </div>
      </div>

      {/* Add Store Form */}
      <div className="space-y-2">
        <label className="text-[10px] uppercase tracking-wider font-bold text-text-muted px-1 block">
          Add New Store
        </label>
        <form onSubmit={handleAddStore} className="flex gap-2">
          <input
            type="text"
            placeholder="e.g. Trader Joe's, Costco..."
            value={newStoreName}
            onChange={(e) => setNewStoreName(e.target.value)}
            className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg py-2.5 px-3 text-xs focus:outline-none focus:border-primary text-white"
          />
          <button
            type="submit"
            className="bg-primary hover:bg-[#c0a9f5] text-black font-semibold rounded-lg px-4 py-2 text-xs transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" /> Add
          </button>
        </form>
      </div>

      {/* Stores List */}
      <div className="space-y-2.5">
        <label className="text-[10px] uppercase tracking-wider font-bold text-text-muted px-1 block">
          Stores List ({activeStores.length})
        </label>
        
        <div className="bg-surface-tile border border-neutral-900 rounded-xl divide-y divide-neutral-900">
          {activeStores.length === 0 ? (
            <div className="p-8 text-center text-xs text-text-muted">
              No stores configured. Add a store above to start.
            </div>
          ) : (
            activeStores.map((store, idx) => {
              const isEditing = editingStoreId === store.id
              return (
                <div key={store.id} className="p-3.5 flex items-center justify-between gap-3 text-sm transition-colors hover:bg-neutral-900/20">
                  {isEditing ? (
                    <div className="flex-1 flex gap-2">
                      <input
                        type="text"
                        value={editingStoreName}
                        onChange={(e) => setEditingStoreName(e.target.value)}
                        className="flex-1 bg-black border border-neutral-800 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-primary text-white"
                        autoFocus
                      />
                      <button
                        onClick={() => handleUpdateStoreName(store.id)}
                        className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-md text-xs font-semibold"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setEditingStoreId(null)
                          setEditingStoreName('')
                        }}
                        className="bg-neutral-900 hover:bg-neutral-800 text-text-muted px-3 py-1 rounded-md text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 truncate">
                        <MapPin className="w-4 h-4 text-primary shrink-0" />
                        <span className="font-semibold text-white truncate">{store.name}</span>
                      </div>
                      
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleMoveStore(store.id, 'up')}
                          disabled={idx === 0}
                          className="p-1.5 hover:bg-neutral-900 rounded-md text-text-muted hover:text-white disabled:opacity-20 disabled:pointer-events-none cursor-pointer"
                          aria-label="Move store up"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveStore(store.id, 'down')}
                          disabled={idx === activeStores.length - 1}
                          className="p-1.5 hover:bg-neutral-900 rounded-md text-text-muted hover:text-white disabled:opacity-20 disabled:pointer-events-none cursor-pointer"
                          aria-label="Move store down"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setEditingStoreId(store.id)
                            setEditingStoreName(store.name)
                          }}
                          className="p-1.5 hover:bg-neutral-900 rounded-md text-text-muted hover:text-white cursor-pointer"
                          aria-label="Edit store"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteStore(store.id)}
                          className="p-1.5 hover:bg-red-500/10 rounded-md text-neutral-500 hover:text-red-400 cursor-pointer"
                          aria-label="Delete store"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </>
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
