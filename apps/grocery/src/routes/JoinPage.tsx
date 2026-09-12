import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, Check, Loader2, ShieldCheck, ShoppingBag, Users } from 'lucide-react'
import api from '@/lib/axios'
import { apiErrorMessage } from '@/lib/apiError'
import { env } from '@/config/env'
import { storage } from '@/utils/storage'
import { STORAGE_KEYS } from '@/config/storageKeys'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useLogin } from '@/features/auth/hooks/useLogin'
import { loadGoogleIdentity } from '@/features/auth/utils/googleIdentity'
import { inviteCodeFromRouteParam } from '@/features/grocery/utils/inviteLink'

/**
 * `/join/:code` — the other end of a shared link.
 *
 * Sharing a list was awkward because the recipient had work to do: install something, find
 * the Join List box, and type eight characters correctly. This page is the whole of that
 * work now. It is public for the same reason `/link` is — the person opening it is by
 * definition not signed in on this browser — and it holds the code across the Google
 * round trip so signing in does not lose the invite.
 *
 * **The join is one deliberate tap, never automatic.** A code is single use and dies with
 * the redemption that spends it, so a page that redeemed on load would burn the invite on
 * any second open: a mis-tap, a back button, a reload, a browser restoring tabs. The button
 * also means nobody joins a stranger's list because a link was in a group chat they
 * scrolled past.
 */

type Stage = 'idle' | 'joining' | 'joined'

/**
 * Where a successful join lands. The list is the root of this origin, and the sync the
 * dashboard runs on mount is what pulls the newly shared list down.
 */
const AFTER_JOIN_ROUTE = '/'

export function JoinPage() {
  const { code: codeParam } = useParams<{ code: string }>()
  const code = inviteCodeFromRouteParam(codeParam)

  const navigate = useNavigate()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const { loginWithGoogle } = useLogin()

  const [stage, setStage] = useState<Stage>('idle')
  const [error, setError] = useState<string | null>(null)
  const [signInError, setSignInError] = useState<string | null>(null)

  const buttonRef = useRef<HTMLDivElement>(null)

  /**
   * Redeems the code and hands the list to the dashboard.
   *
   * `LAST_SYNCED` goes first, for the reason `JoinListSheet` clears it: `syncNow`
   * short-circuits when `/api/sync/status` says nothing has changed, and a list that arrived
   * through a membership row somebody else wrote is exactly the change that check can miss.
   * The active list is written straight to storage rather than through `GroceryContext`,
   * which is not mounted out here — it reads this key when it initialises, one route later.
   */
  const redeem = useCallback(async () => {
    if (!code) return
    setStage('joining')
    setError(null)

    try {
      const response = await api.post<{ success: boolean; listId?: string; list_id?: string }>(
        '/api/lists/join',
        { code },
      )
      // The API renames this to `listId`; older builds of it sent `list_id`.
      const listId = response.data.listId || response.data.list_id

      if (!response.data.success || !listId) {
        setError('That invite could not be used. Ask for a new link.')
        setStage('idle')
        return
      }

      storage.removeItem(STORAGE_KEYS.LAST_SYNCED)
      storage.setItem(STORAGE_KEYS.ACTIVE_LIST_ID, listId)
      setStage('joined')
      navigate(AFTER_JOIN_ROUTE, { replace: true })
    } catch (err) {
      console.error('Failed to redeem an invite link:', err)
      setError(
        apiErrorMessage(
          err,
          'Could not reach the server. Check your connection and try the link again.',
        ),
      )
      setStage('idle')
    }
  }, [code, navigate])

  /**
   * Signing in *is* the deliberate tap when the page starts signed out, so the join follows it
   * without a second one.
   *
   * Held in a ref, and kept out of the effect's dependencies, for two reasons that both end the
   * same way. Google's callback is handed to `initialize` once and lives inside the button it
   * draws, so closing over state would capture it as it was when the button was drawn. And
   * `useLogin` returns a fresh `loginWithGoogle` on every render, so depending on it would tear
   * Google's button down and redraw it under the recipient's finger on any state change.
   */
  const signInAndJoinRef = useRef<(credential: string) => void>(() => {})
  useEffect(() => {
    signInAndJoinRef.current = (credential: string) => {
      setSignInError(null)
      loginWithGoogle(credential)
        .then(() => redeem())
        .catch((err: unknown) => {
          console.error('Sign-in from an invite link failed:', err)
          setSignInError(apiErrorMessage(err, 'Signing in did not work. Try the link again.'))
        })
    }
  }, [loginWithGoogle, redeem])

  // Draw the Google button only while there is a code to redeem and nobody signed in.
  useEffect(() => {
    if (!code || authLoading || isAuthenticated) return
    let cancelled = false

    loadGoogleIdentity()
      .then((google) => {
        if (cancelled || !buttonRef.current) return
        google.accounts.id.initialize({
          client_id: env.GOOGLE_CLIENT_ID,
          callback: (response) => {
            if (response.credential) signInAndJoinRef.current(response.credential)
          },
          auto_select: false,
        })
        google.accounts.id.renderButton(buttonRef.current, {
          type: 'standard',
          theme: 'filled_black',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular',
          width: 280,
        })
      })
      .catch((err: Error) => {
        if (!cancelled) setSignInError(err.message)
      })

    return () => {
      cancelled = true
    }
  }, [code, authLoading, isAuthenticated])

  return (
    <div className="min-h-dvh bg-canvas text-text-primary flex flex-col items-center font-sans antialiased selection:bg-primary selection:text-on-primary">
      <div className="app-frame min-h-dvh bg-canvas flex flex-col border-x border-line-faint shadow-[var(--shadow-frame)] px-6 py-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] justify-center">
        <main className="flex flex-col items-center text-center space-y-7 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="p-4 rounded-2xl bg-surface-raised border border-line/60 shadow-[var(--shadow-halo)] text-primary">
            {stage === 'joined' ? (
              <Check className="w-9 h-9 text-success" />
            ) : code ? (
              <Users className="w-9 h-9" />
            ) : (
              <ShoppingBag className="w-9 h-9" />
            )}
          </div>

          {!code ? (
            <BadLink />
          ) : stage === 'joined' ? (
            <div className="space-y-1.5">
              <h1 className="text-2xl font-black tracking-tight">You&apos;re on the list</h1>
              <p className="text-xs text-text-muted max-w-[300px]">Opening it now.</p>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <h1 className="text-2xl font-black tracking-tight">
                  You&apos;ve been invited to a list
                </h1>
                <p className="text-xs text-text-muted max-w-[300px]">
                  Someone shared a grocery list with you. Join it and you&apos;ll both see the
                  same list, on every device either of you uses.
                </p>
              </div>

              <div className="w-full bg-inset border border-line rounded-xl py-3.5 flex items-center justify-center">
                <span className="text-xl font-mono font-bold tracking-widest text-primary">
                  {code}
                </span>
              </div>

              {authLoading ? (
                <div className="flex items-center gap-2 text-xs text-text-muted">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Restoring session...</span>
                </div>
              ) : isAuthenticated ? (
                <button
                  type="button"
                  onClick={redeem}
                  disabled={stage === 'joining'}
                  className="w-full max-w-[300px] flex items-center justify-center gap-2 py-3 px-4 bg-primary hover:bg-primary-hover text-on-primary font-semibold rounded-lg text-sm active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {stage === 'joining' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Joining...</span>
                    </>
                  ) : (
                    <>
                      <span>Join this list</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <p className="text-[11px] text-text-muted max-w-[280px]">
                    Sign in and you&apos;ll be added to the list straight away.
                  </p>
                  <div
                    ref={buttonRef}
                    className="min-h-[48px] flex items-center justify-center"
                  />
                  {stage === 'joining' && (
                    <div className="flex items-center gap-2 text-xs text-text-muted">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Joining...</span>
                    </div>
                  )}
                </div>
              )}

              {(error || signInError) && (
                <p className="text-xs text-danger max-w-[300px]">{error || signInError}</p>
              )}
            </>
          )}

          <div className="flex items-center gap-1.5 text-[10px] text-text-subtle font-medium bg-inset/40 border border-line-faint/60 px-3 py-1.5 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5 text-success" />
            <span>Invites are single use and expire</span>
          </div>
        </main>
      </div>
    </div>
  )
}

/**
 * What a mangled link says. Messaging apps rewrite URLs, and a link read out and retyped
 * loses characters, so this is a real case rather than a defensive branch — and the answer
 * is always the same one: the sender presses share again.
 */
function BadLink() {
  return (
    <div className="space-y-1.5">
      <h1 className="text-2xl font-black tracking-tight">This invite link is incomplete</h1>
      <p className="text-xs text-text-muted max-w-[300px]">
        The code at the end of it is missing or was cut short. Ask whoever sent it to share
        the list again — or open the app and type the code into Join List.
      </p>
    </div>
  )
}

export default JoinPage
