import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useLogin } from '../hooks/useLogin'
import { loadGoogleIdentity } from '../utils/googleIdentity'
import { env } from '@/config/env'

/**
 * The Google button, for a browser that holds an invite.
 *
 * Only ever drawn once the sign-in screen knows there is an invite to sign in with (see
 * `LoginPage`): without one the API refuses every sign-in from this origin, so offering a
 * button would be offering a Google prompt that can only end in a refusal.
 *
 * `invitedEmail` is what the refusal is worded around. The one mistake left to make is
 * choosing a different Google account from the one the invite names, which the API answers
 * with `403 todo_web_invite_email_mismatch`.
 */
export function LoginForm({ invitedEmail }: { invitedEmail?: string }) {
  const { loginWithGoogle, isLoading, error, needsInvite, refusal } = useLogin()
  const navigate = useNavigate()
  const buttonRef = useRef<HTMLDivElement>(null)
  const [gsiError, setGsiError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  /**
   * Held in a ref and kept out of the effect's dependencies: Google's callback is handed to
   * `initialize` once and lives inside the button it draws, and `useLogin` returns a fresh
   * `loginWithGoogle` every render, so depending on it would redraw Google's button under the
   * person's finger.
   */
  const signInRef = useRef<(credential: string) => void>(() => {})
  useEffect(() => {
    signInRef.current = (credential: string) => {
      loginWithGoogle(credential)
        .then(() => navigate('/', { replace: true }))
        .catch((err: unknown) => console.error('Google sign-in exchange failed:', err))
    }
  }, [loginWithGoogle, navigate])

  useEffect(() => {
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
        setReady(true)
      })
      .catch((err: Error) => {
        if (!cancelled) setGsiError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex flex-col items-center justify-center gap-4 w-full">
      {(refusal === 'email_mismatch' || ((refusal === 'invite_required' || needsInvite) && invitedEmail)) && (
        <p className="text-xs text-danger max-w-[300px] text-center">
          {invitedEmail
            ? `That Google account isn't the one this invite is for. Sign in as ${invitedEmail}.`
            : "That Google account isn't the one this invite is for. Sign in with the address the invite was sent to."}
        </p>
      )}
      {(refusal === 'invite_required' || needsInvite) && !invitedEmail && (
        <p className="text-xs text-danger max-w-[300px] text-center">
          This browser holds no invite, or it has expired. Open the invite link you were sent, in this browser.
        </p>
      )}

      {gsiError && <p className="text-xs text-danger max-w-[300px] text-center">{gsiError}</p>}
      {error && <p className="text-xs text-danger max-w-[300px] text-center">{error.message}</p>}

      <div
        ref={buttonRef}
        className="min-h-[48px] flex items-center justify-center"
        style={{ opacity: isLoading || !ready ? 0.6 : 1 }}
      />

      {isLoading && (
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Signing in...</span>
        </div>
      )}

      {env.isDev && (
        <button
          type="button"
          onClick={() => signInRef.current('mock.eyJzdWIiOiJkZXZfdXNlcl8xMjMifQ.mock')}
          disabled={isLoading}
          className="w-[280px] bg-surface-raised border border-line hover:border-line-strong text-text-secondary font-semibold text-xs py-3 px-5 rounded-lg cursor-pointer"
        >
          Dev Mode: Bypass Auth
        </button>
      )}
    </div>
  )
}
export default LoginForm
