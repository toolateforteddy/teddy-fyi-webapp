import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, Loader2, MailCheck, ShieldCheck, ShoppingBag } from 'lucide-react'
import { env } from '@/config/env'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useLogin } from '@/features/auth/hooks/useLogin'
import { loadGoogleIdentity } from '@/features/auth/utils/googleIdentity'
import { isAccountRefused } from '@/features/auth/utils/accountRefusal'
import { inviteCodeFromRouteParam } from '@/features/auth/utils/accountInviteLink'
import { apiErrorMessage } from '@/lib/apiError'

/**
 * `/invite/:code` — where somebody who has no account gets one.
 *
 * An account invite is a credential authorising exactly one account creation, and until now
 * the only way it could travel was as two hundred characters of base64 with an instruction
 * attached: install the app, sign in with Google, wait to be refused, find the field the
 * refusal offers, paste this into it. The recipient is by definition the person in the whole
 * system with the least context — they have no account, so they have never seen any of these
 * apps — and that is a lot to ask of them.
 *
 * This page is all five of those steps. It is public for the same reason `/join/:code` and
 * `/link` are — whoever opens it is not signed in on this browser and cannot be — and it holds
 * the code across the Google round trip, so signing in and redeeming happen on the same
 * request rather than one losing the other.
 *
 * **Unlike `/join/:code`, signing in here is the whole of it and needs no confirming tap.**
 * That page asks first because a list code is single use and dies with the redemption that
 * spends it, so an automatic join would burn the invite on a reload. An account invite has no
 * such edge: it is stateless, nothing marks it spent, and it only ever admits the one verified
 * address it names — so a second open by the same person is idempotent, and by anybody else is
 * refused whether they meant it or not.
 */

/** Where a created account lands: the list itself, which is the root of this origin. */
const AFTER_SIGN_IN_ROUTE = '/'

/**
 * What a refused sign-in says.
 *
 * The server answers the same `403` whether the invite expired, was for a different address,
 * or was never presented at all, and that is deliberate — the three are one fact, *this
 * sign-in may not create an account*, and distinguishing them would tell a stranger which
 * half of a code they got right. So this names the two things the recipient can actually
 * check, rather than guessing at which one it was.
 */
const REFUSED =
  "That invite didn't work. It only admits the one email address it was sent to, and it " +
  'stops working once it expires — check you picked the right Google account, or ask ' +
  'whoever sent it for a fresh link.'

export function InvitePage() {
  const { code: codeParam } = useParams<{ code: string }>()
  const code = inviteCodeFromRouteParam(codeParam)

  const navigate = useNavigate()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const { loginWithGoogle } = useLogin()

  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const buttonRef = useRef<HTMLDivElement>(null)

  const signIn = useCallback(
    async (credential: string) => {
      setWorking(true)
      setError(null)
      try {
        await loginWithGoogle(credential, code ?? undefined)
        navigate(AFTER_SIGN_IN_ROUTE, { replace: true })
      } catch (err: unknown) {
        console.error('Signing in from an account invite failed:', err)
        setError(
          isAccountRefused(err)
            ? REFUSED
            : apiErrorMessage(err, 'Signing in did not work. Try the link again.'),
        )
        setWorking(false)
      }
    },
    [code, loginWithGoogle, navigate],
  )

  /**
   * Held in a ref and kept out of the effect's dependencies, for the two reasons `JoinPage`
   * records: Google's callback is handed to `initialize` once and then lives inside the button
   * it draws, so closing over state would capture it as it was when the button was drawn; and
   * `useLogin` returns a fresh `loginWithGoogle` on every render, so depending on it would
   * tear Google's button down and redraw it under the recipient's finger.
   */
  const signInRef = useRef<(credential: string) => void>(() => {})
  useEffect(() => {
    signInRef.current = (credential: string) => void signIn(credential)
  }, [signIn])

  // Drawn only while there is a code to redeem and nobody signed in.
  useEffect(() => {
    if (!code || authLoading || isAuthenticated) return
    let cancelled = false

    loadGoogleIdentity()
      .then((google) => {
        if (cancelled || !buttonRef.current) return
        google.accounts.id.initialize({
          client_id: env.GOOGLE_CLIENT_ID,
          callback: (response) => {
            if (response.credential) signInRef.current(response.credential)
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
        if (!cancelled) setError(err.message)
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
            {code ? <MailCheck className="w-9 h-9" /> : <ShoppingBag className="w-9 h-9" />}
          </div>

          {!code ? (
            <BadLink />
          ) : authLoading ? (
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Restoring session...</span>
            </div>
          ) : isAuthenticated ? (
            <AlreadyIn onOpen={() => navigate(AFTER_SIGN_IN_ROUTE, { replace: true })} />
          ) : (
            <>
              <div className="space-y-1.5">
                <h1 className="text-2xl font-black tracking-tight">
                  You&apos;ve been invited to teddy.fyi
                </h1>
                <p className="text-xs text-text-muted max-w-[300px]">
                  Sign in with Google and your account is created right here — nothing to set
                  up, and nothing to type in. Then you have shared grocery lists on every
                  device you use.
                </p>
              </div>

              <div className="flex flex-col items-center gap-3">
                <p className="text-[11px] text-text-muted max-w-[280px]">
                  Use the Google account this invite was sent to. It only works for that one
                  address.
                </p>
                <div ref={buttonRef} className="min-h-[48px] flex items-center justify-center" />
                {working && (
                  <div className="flex items-center gap-2 text-xs text-text-muted">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Setting up your account...</span>
                  </div>
                )}
              </div>
            </>
          )}

          {error && <p className="text-xs text-danger max-w-[300px]">{error}</p>}

          <div className="flex items-center gap-1.5 text-[10px] text-text-subtle font-medium bg-inset/40 border border-line-faint/60 px-3 py-1.5 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5 text-success" />
            <span>Invites admit one address, and expire</span>
          </div>
        </main>
      </div>
    </div>
  )
}

/**
 * What somebody who is already signed in sees.
 *
 * Not an error and not a dead end: an invite creates an account, so a browser that already
 * has one has nothing left for this page to do. The second line is the case worth naming —
 * the invite was for a *different* address than the account in this browser, which looks
 * identical from here and is the one thing the person can act on.
 */
function AlreadyIn({ onOpen }: { onOpen: () => void }) {
  return (
    <>
      <div className="space-y-1.5">
        <h1 className="text-2xl font-black tracking-tight">You&apos;re already signed in</h1>
        <p className="text-xs text-text-muted max-w-[300px]">
          This browser already has an account, so there is nothing for the invite to do. If it
          was meant for a different Google account, sign out in Settings and open the link
          again.
        </p>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="w-full max-w-[300px] flex items-center justify-center gap-2 py-3 px-4 bg-primary hover:bg-primary-hover text-on-primary font-semibold rounded-lg text-sm active:scale-95 transition-all cursor-pointer"
      >
        <span>Open my lists</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </>
  )
}

/**
 * What a mangled link says. The same real case `/join/:code` has — messaging apps rewrite
 * URLs, mail clients hyperlink half of one — and much likelier here, because the code on the
 * end of this link is two hundred characters rather than eight.
 */
function BadLink() {
  return (
    <div className="space-y-1.5">
      <h1 className="text-2xl font-black tracking-tight">This invite link is incomplete</h1>
      <p className="text-xs text-text-muted max-w-[300px]">
        The code at the end of it is missing or was cut short — long links do not always
        survive being sent. Ask whoever invited you to send it again.
      </p>
    </div>
  )
}

export default InvitePage
