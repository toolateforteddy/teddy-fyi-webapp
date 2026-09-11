import { useState, useEffect, useRef } from 'react'
import type { FormEvent } from 'react'
import { Plus, X, Loader2 } from 'lucide-react'
import api from '@/lib/axios'
import { apiErrorMessage } from '@/lib/apiError'
import { useGrocery } from '@/features/grocery/context/GroceryContext'
import { storage } from '@/utils/storage'
import { STORAGE_KEYS } from '@/config/storageKeys'

interface JoinListSheetProps {
  isOpen: boolean
  onClose: () => void
}

export function JoinListSheet({ isOpen, onClose }: JoinListSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const { handleManualSync, setActiveListId } = useGrocery()
  const [joinCode, setJoinCode] = useState('')
  const [isJoining, setIsJoining] = useState(false)
  const [isSyncingPostJoin, setIsSyncingPostJoin] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal()
        setJoinCode('')
        setError(null)
      }
    } else {
      if (dialog.open) {
        dialog.close()
      }
    }
  }, [isOpen])

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault()
    if (!joinCode || joinCode.trim().length !== 8) {
      setError('Please enter a valid 8-character invite code.')
      return
    }

    setIsJoining(true)
    setError(null)

    try {
      const response = await api.post<{ success: boolean; list_id: string }>('/api/lists/join', {
        code: joinCode.trim().toUpperCase()
      })

      if (response.data.success && response.data.list_id) {
        const newListId = response.data.list_id
        
        setIsSyncingPostJoin(true)
        storage.removeItem(STORAGE_KEYS.LAST_SYNCED)
        
        await handleManualSync()
        setActiveListId(newListId)
        onClose()
      } else {
        setError('Failed to join list. The code may be invalid or expired.')
      }
    } catch (err: any) {
      console.error('Failed to join list:', err)
      setError(apiErrorMessage(err, 'Could not reach the server. Check your connection and try again.'))
    } finally {
      setIsJoining(false)
      setIsSyncingPostJoin(false)
    }
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
          <Plus className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-white">Join Shared List</h3>
        </div>
        <button 
          onClick={onClose}
          disabled={isJoining || isSyncingPostJoin}
          className="p-1 text-text-muted hover:text-white rounded-md disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {isSyncingPostJoin ? (
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm font-medium text-white">Downloading list items...</p>
          <p className="text-xs text-text-muted">Performing initial synchronization...</p>
        </div>
      ) : (
        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label htmlFor="join-code" className="text-[10px] uppercase tracking-wider font-bold text-text-muted block mb-1.5">
              Invite Code (8 Alphanumerics)
            </label>
            <input
              id="join-code"
              type="text"
              placeholder="e.g. ABC123XY"
              maxLength={8}
              disabled={isJoining}
              value={joinCode}
              onChange={(e) => {
                const val = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
                setJoinCode(val)
              }}
              autoFocus
              className="w-full bg-black/40 border border-neutral-800 rounded-lg py-2.5 px-3.5 text-center text-lg font-mono tracking-widest focus:outline-none focus:border-primary transition-colors text-white placeholder-neutral-600 disabled:opacity-50"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 text-center animate-in fade-in duration-100">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isJoining}
              className="flex-1 py-2.5 px-4 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 hover:text-white text-xs font-semibold rounded-lg text-text-muted active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isJoining || joinCode.length !== 8}
              className="flex-1 py-2.5 px-4 bg-primary hover:bg-[#c0a9f5] text-black font-semibold rounded-lg text-xs active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isJoining ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Joining...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Join</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </dialog>
  )
}
