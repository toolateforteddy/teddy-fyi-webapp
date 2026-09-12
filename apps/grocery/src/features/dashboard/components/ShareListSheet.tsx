import { useState, useEffect, useCallback, useRef } from 'react'
import { Share2, X, Loader2, Copy, Check, Link2 } from 'lucide-react'
import api from '@/lib/axios'
import { apiErrorMessage } from '@/lib/apiError'
import { inviteLinkFor } from '@/features/grocery/utils/inviteLink'

interface ShareListSheetProps {
  isOpen: boolean
  onClose: () => void
  activeListId: string
}

/** How long a copy button stays in its confirmed state before offering another copy. */
const COPIED_CONFIRMATION_MS = 2000

/**
 * The invite as the sender's own device would describe it, for the OS share sheet.
 *
 * Both `text` and `url` are sent because share targets disagree about what they take: a
 * messaging app uses the URL and renders a preview, while something that only understands
 * plain text gets a sentence with the link in it rather than a bare URL with no explanation.
 */
function shareData(link: string) {
  return {
    title: 'Join my grocery list',
    text: `Join my grocery list: ${link}`,
    url: link,
  }
}

export function ShareListSheet({ isOpen, onClose, activeListId }: ShareListSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<'link' | 'code' | null>(null)

  const generateCode = useCallback(async () => {
    setIsGenerating(true)
    setError(null)
    setInviteCode(null)
    try {
      // The API also answers with `url` and `expiresAt` now. `url` is deliberately not used
      // here -- see inviteLink.ts: this app is the join page, so its own origin is the one
      // thing it cannot be wrong about, and the server's answer would hand out production
      // links from a dev server.
      const response = await api.post<{ code: string }>('/api/lists/invite', {
        list_id: activeListId
      })
      setInviteCode(response.data.code)
    } catch (err: any) {
      console.error('Failed to generate invite code:', err)
      setError(apiErrorMessage(err, 'Could not reach the server. Check your connection and try again.'))
    } finally {
      setIsGenerating(false)
    }
  }, [activeListId])

  // The code this sheet last obtained, per list. Opening the sheet again shows that code
  // rather than minting another, because minting *supersedes*: the server keeps one live
  // code per list and deletes the previous one. Re-opening to re-read a code you have
  // already sent someone therefore used to kill the code they were holding, and the only
  // evidence was the "invalid or expired" they got back. Superseding is still available,
  // it is just a button somebody presses on purpose now.
  const issuedForListRef = useRef<string | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal()
        if (issuedForListRef.current !== activeListId || !inviteCode) {
          issuedForListRef.current = activeListId
          generateCode()
        }
      }
    } else {
      if (dialog.open) {
        dialog.close()
      }
    }
    // `inviteCode` is deliberately not a dependency: this effect reacts to the sheet
    // opening, and re-running it when the code arrives would mint a second one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeListId, generateCode])

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(null), COPIED_CONFIRMATION_MS)
    return () => clearTimeout(timer)
  }, [copied])

  const inviteLink = inviteCode ? inviteLinkFor(inviteCode) : null

  const copy = async (what: 'link' | 'code', value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(what)
    } catch (err) {
      // A clipboard write can be refused outright -- an insecure origin, a permission
      // policy, a browser that has never had one. Saying so beats a button that does
      // nothing, because the link is still on screen to select by hand.
      console.error('Clipboard write refused:', err)
      setError('This browser would not let the app copy. Select the link and copy it by hand.')
    }
  }

  /**
   * Hands the link to the OS share sheet, which is what puts it in the conversation the
   * sender is already having. Falls back to the clipboard where there is no share sheet
   * (every desktop browser but Safari and Edge) -- and treats an `AbortError` as what it
   * is, somebody dismissing the sheet, rather than as a failure worth a red line.
   */
  const share = async () => {
    if (!inviteLink) return
    if (!navigator.share) {
      await copy('link', inviteLink)
      return
    }
    try {
      await navigator.share(shareData(inviteLink))
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return
      console.error('Share sheet failed:', err)
      await copy('link', inviteLink)
    }
  }

  // top-auto and max-w-none override the <dialog> UA styles (inset: 0 and
  // max-width: calc(100% - padding)), which otherwise pin this sheet to the top
  // edge at less than full width. Tailwind's preflight resets the UA margin: auto.
  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="app-frame fixed top-auto bottom-0 left-1/2 -translate-x-1/2 max-h-[85dvh] overflow-y-auto overscroll-contain bg-surface-tile border-t border-line rounded-t-2xl z-50 px-4 pt-4 pb-[calc(2rem+env(safe-area-inset-bottom))] shadow-2xl backdrop:bg-scrim/60 backdrop:backdrop-blur-sm animate-in slide-in-from-bottom duration-250 ease-out focus:outline-none"
    >
      <div className="flex items-center justify-between mb-4 border-b border-line pb-3">
        <div className="flex items-center gap-1.5">
          <Share2 className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-text-primary">Share List</h3>
        </div>
        <button 
          onClick={onClose}
          className="p-1 text-text-muted hover:text-text-primary rounded-md cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-4 py-2">
        {isGenerating ? (
          <div className="flex flex-col items-center justify-center py-6 gap-3">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-text-muted">Generating invite...</p>
          </div>
        ) : error && !inviteCode ? (
          <div className="space-y-3 text-center">
            <p className="text-sm text-danger">{error}</p>
            <button
              onClick={generateCode}
              className="py-2 px-4 bg-primary text-on-primary font-semibold rounded-lg text-xs active:scale-95 transition-all cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : inviteCode && inviteLink ? (
          <div className="space-y-4">
            <p className="text-xs text-text-muted text-center">
              Send this link. Whoever opens it signs in and joins the list — nothing to
              install, nothing to type. It works once, and lasts an hour.
            </p>

            {/* The link, and the two ways to move it. Sending is the primary action: the
                code below it is the fallback for somebody you cannot send a link to. */}
            <div className="w-full bg-inset border border-line rounded-xl px-3 py-3 flex items-center gap-2">
              <Link2 className="w-4 h-4 text-primary shrink-0" />
              <span className="text-[11px] font-mono text-text-secondary break-all leading-relaxed">
                {inviteLink}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={share}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-primary hover:bg-primary-hover text-on-primary font-semibold rounded-lg text-xs active:scale-95 transition-all cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>Send invite link</span>
              </button>
              <button
                onClick={() => copy('link', inviteLink)}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-surface-raised border border-line hover:border-line-strong hover:text-text-primary text-xs font-semibold rounded-lg text-text-muted active:scale-95 transition-all cursor-pointer"
              >
                {copied === 'link' ? (
                  <>
                    <Check className="w-4 h-4 text-success" />
                    <span className="text-success">Link copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>
            </div>

            {/* The code the link carries. Still here because a link is no use to somebody on
                a tablet with no messaging app, or somebody you are reading it to down the
                phone -- and because it is the same credential either way. */}
            <div className="pt-1 border-t border-line/60 space-y-2">
              <p className="text-[10px] text-text-muted text-center pt-3">
                Or read out the code, and they can type it into Join List.
              </p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-xl font-mono font-bold tracking-widest text-primary">
                  {inviteCode}
                </span>
                <button
                  onClick={() => copy('code', inviteCode)}
                  aria-label={copied === 'code' ? 'Invite code copied' : 'Copy invite code'}
                  className="p-1.5 text-text-muted hover:text-text-primary rounded-md cursor-pointer"
                >
                  {copied === 'code' ? (
                    <Check className="w-4 h-4 text-success" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {error && <p className="text-[11px] text-danger text-center">{error}</p>}

            <div className="flex flex-col items-center gap-1.5">
              <button
                onClick={generateCode}
                className="text-[11px] text-text-muted underline underline-offset-2 hover:text-text-primary transition-colors cursor-pointer"
              >
                Get a new link
              </button>
              <p className="text-[10px] text-text-muted text-center">
                A new link replaces this one, so anyone still holding it will not get in.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </dialog>
  )
}
