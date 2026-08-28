import { useState, useEffect, useRef } from 'react'
import { Share2, X, Loader2, Copy, Check } from 'lucide-react'
import api from '@/lib/axios'

interface ShareListSheetProps {
  isOpen: boolean
  onClose: () => void
  activeListId: string
}

export function ShareListSheet({ isOpen, onClose, activeListId }: ShareListSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal()
        generateCode()
      }
    } else {
      if (dialog.open) {
        dialog.close()
      }
    }
  }, [isOpen])

  const generateCode = async () => {
    setIsGenerating(true)
    setError(null)
    setInviteCode(null)
    try {
      const response = await api.post<{ code: string }>('/api/lists/invite', {
        list_id: activeListId
      })
      setInviteCode(response.data.code)
    } catch (err: any) {
      console.error('Failed to generate invite code:', err)
      setError(err.response?.data?.message || 'Failed to generate invite code. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopyCode = () => {
    if (!inviteCode) return
    navigator.clipboard.writeText(inviteCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // top-auto and max-w-none override the <dialog> UA styles (inset: 0 and
  // max-width: calc(100% - padding)), which otherwise pin this sheet to the top
  // edge at less than full width. Tailwind's preflight resets the UA margin: auto.
  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="fixed top-auto bottom-0 left-0 right-0 w-full max-w-none md:max-w-md md:mx-auto bg-surface-tile border-t border-neutral-800 rounded-t-2xl z-50 px-4 pt-4 pb-[calc(2rem+env(safe-area-inset-bottom))] shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm animate-in slide-in-from-bottom duration-250 ease-out focus:outline-none"
    >
      <div className="flex items-center justify-between mb-4 border-b border-neutral-800 pb-3">
        <div className="flex items-center gap-1.5">
          <Share2 className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-white">Share List</h3>
        </div>
        <button 
          onClick={onClose}
          className="p-1 text-text-muted hover:text-white rounded-md cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-4 py-2">
        {isGenerating ? (
          <div className="flex flex-col items-center justify-center py-6 gap-3">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-text-muted">Generating invite code...</p>
          </div>
        ) : error ? (
          <div className="space-y-3 text-center">
            <p className="text-sm text-red-400">{error}</p>
            <button
              onClick={generateCode}
              className="py-2 px-4 bg-primary text-black font-semibold rounded-lg text-xs active:scale-95 transition-all cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : inviteCode ? (
          <div className="space-y-4">
            <p className="text-xs text-text-muted text-center">
              Share this 8-digit invite code with household members to collaborate on this list.
            </p>
            <div className="flex flex-col items-center gap-3">
              <div className="w-full bg-black/40 border border-neutral-800 rounded-xl py-4 flex items-center justify-center">
                <span className="text-2xl font-mono font-bold tracking-widest text-primary selection:bg-transparent">
                  {inviteCode}
                </span>
              </div>
              <button
                onClick={handleCopyCode}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 hover:text-white text-xs font-semibold rounded-lg text-text-muted active:scale-95 transition-all cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-500" />
                    <span className="text-emerald-500">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </dialog>
  )
}
