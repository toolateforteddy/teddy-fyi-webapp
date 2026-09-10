import { useCallback, useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { ArrowLeft, Check, Loader2, ShieldCheck, Tablet, Terminal } from 'lucide-react'
import { env } from '@/config/env'
import { CODE_LENGTH, formatDeviceCode, normalizeDeviceCode } from '@/utils/deviceCode'
import { emailFromIdToken, loadGoogleIdentity } from '@/features/auth/utils/googleIdentity'
import { cn } from '@/utils/cn'

/**
 * `/link` — signing a tablet in from a device that has a Google account.
 *
 * A Fire tablet has no Google Play Services, so the Android app's account
 * chooser cannot run there: it asks the API for an eight-character code
 * instead, shows it, and polls. This page is the other half — sign in here
 * with the Google account the lists belong to, type the code, and the tablet
 * collects the same session a normal sign-in would have minted.
 *
 * Nothing about a grocery list is touched here. All this page does is tell the
 * API which account the waiting tablet belongs to.
 */

/**
 * The API locks a Google account out of claiming for ten minutes after five
 * wrong codes, so the page stops guessing before it gets there rather than
 * saying "invalid code" a sixth time.
 */
const MAX_ATTEMPTS = 5
const LOCKOUT_MINUTES = 10

type Stage = 'signed-out' | 'code-entry' | 'done'

const STEPS = [
  'Open the grocery app on the tablet and tap Sign in.',
  'The tablet shows an eight-character code and waits.',
  'Sign in here with the Google account the lists belong to, then type that code.',
]

export function DeviceLinkPage() {
  const [stage, setStage] = useState<Stage>('signed-out')
  const [idToken, setIdToken] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)

  const [input, setInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempts, setAttempts] = useState(0)
  const [lockedOut, setLockedOut] = useState(false)

  const buttonRef = useRef<HTMLDivElement>(null)
  const [signInError, setSignInError] = useState<string | null>(null)

  const onCredential = useCallback((credential: string) => {
    setIdToken(credential)
    setEmail(emailFromIdToken(credential))
    setSignInError(null)
    setStage('code-entry')
  }, [])

  // Render the Google button while the page is signed out.
  useEffect(() => {
    if (stage !== 'signed-out') return
    let cancelled = false

    loadGoogleIdentity()
      .then((google) => {
        if (cancelled || !buttonRef.current) return
        google.accounts.id.initialize({
          client_id: env.GOOGLE_CLIENT_ID,
          callback: (response) => {
            if (response.credential) onCredential(response.credential)
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
  }, [stage, onCredential])

  const normalized = normalizeDeviceCode(input)
  const canSubmit = normalized.isComplete && !submitting && !lockedOut

  async function claim(event: React.FormEvent) {
    event.preventDefault()
    if (!canSubmit || !idToken) return

    setSubmitting(true)
    setError(null)

    try {
      await axios.post(
        `${env.API_BASE_URL}/auth/device/claim`,
        { google_auth_token: idToken, user_code: normalized.code },
        { headers: { 'Content-Type': 'application/json' } },
      )
      setStage('done')
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined
      const nextAttempts = attempts + 1

      // An unknown code and an expired one are the same 404 on purpose, so the
      // copy has to cover both without claiming to know which happened.
      if (status === 404) {
        setAttempts(nextAttempts)
        if (nextAttempts >= MAX_ATTEMPTS) {
          setLockedOut(true)
          setError(
            `That code did not match either. Five wrong codes locks this Google account out of pairing for ${LOCKOUT_MINUTES} minutes, so stop here — check the tablet, and try again in ${LOCKOUT_MINUTES} minutes.`,
          )
        } else {
          const left = MAX_ATTEMPTS - nextAttempts
          setError(
            `We could not find that code. Codes expire after a few minutes, so if the tablet has been sitting a while, tap Sign in again for a fresh one. ${left} ${
              left === 1 ? 'try' : 'tries'
            } left before pairing pauses for ${LOCKOUT_MINUTES} minutes.`,
          )
        }
      } else if (status === 429) {
        setLockedOut(true)
        setError(
          `Too many wrong codes. Pairing is paused for this Google account for ${LOCKOUT_MINUTES} minutes. Nothing on the tablet is affected — try again after that.`,
        )
      } else if (status === 401) {
        setError('That sign-in has expired. Reload the page and sign in again.')
      } else {
        setError('We could not reach the pairing service. Check your connection and try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-dvh bg-black text-white flex flex-col items-center font-sans antialiased selection:bg-primary selection:text-black">
      <div className="app-frame min-h-dvh bg-black flex flex-col border-x border-[#1a1a1a] shadow-[0_0_50px_0_rgba(208,188,255,0.05)] px-6 py-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] gap-8">

        <header className="flex items-center justify-between">
          {/* teddy.fyi is a different origin now, so this is an anchor rather
              than a <Link> -- react-router cannot route across origins. */}
          <a
            href="https://teddy.fyi"
            className="flex items-center gap-1 text-text-muted hover:text-white transition-colors text-xs font-semibold"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </a>
          <div className="flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-neutral-600 font-semibold">
            <Terminal className="w-3 h-3" />
            <span>teddy.fyi</span>
          </div>
        </header>

        <main className="flex-1 space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-[10px] font-mono tracking-wider text-primary">
              <Tablet className="w-3.5 h-3.5" />
              <span>Tablet sign-in</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">Link a tablet</h1>
            <p className="text-xs text-text-muted leading-relaxed">
              Fire tablets have no Google sign-in of their own, so the grocery app cannot ask for an
              account on the tablet itself. This page does that half for it: sign in here, type the
              code the tablet is showing, and the tablet picks up the rest.
            </p>
          </div>

          {stage === 'signed-out' && (
            <section className="space-y-6">
              <ol className="space-y-3">
                {STEPS.map((step, i) => (
                  <li
                    key={step}
                    className="flex gap-3 items-start text-xs text-text-muted leading-relaxed"
                  >
                    <span className="shrink-0 w-6 h-6 rounded-full bg-neutral-950 border border-neutral-800 text-[10px] font-mono text-primary grid place-items-center">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>

              <div className="w-full bg-[#1A1A1A] border border-neutral-900 rounded-2xl p-6 flex flex-col items-center gap-3">
                <div ref={buttonRef} className="min-h-[48px] flex items-center justify-center" />
                {signInError && (
                  <p className="text-xs text-red-400 leading-relaxed text-center">
                    {signInError}. Reload the page to try again.
                  </p>
                )}
                <p className="text-[10px] text-neutral-500 leading-relaxed text-center">
                  Signing in here only tells us which account the tablet belongs to. The lists
                  themselves are untouched.
                </p>
              </div>
            </section>
          )}

          {stage === 'code-entry' && (
            <section className="space-y-5">
              <div className="space-y-1">
                <h2 className="text-lg font-extrabold text-white tracking-tight">
                  Type the code on the tablet
                </h2>
                {email && <p className="text-[10px] font-mono text-neutral-500">Signed in as {email}</p>}
              </div>

              <form onSubmit={claim} className="space-y-4">
                <label htmlFor="user-code" className="block text-xs text-text-muted leading-relaxed">
                  Eight characters, shown on the tablet as something like{' '}
                  <span className="font-mono text-white">H4KP-9TQR</span>. Upper or lower case, with
                  or without the hyphen — paste it if you like.
                </label>

                <input
                  id="user-code"
                  name="user-code"
                  type="text"
                  inputMode="text"
                  autoComplete="one-time-code"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  autoFocus
                  maxLength={16}
                  disabled={lockedOut}
                  value={input}
                  onChange={(e) => {
                    // Silently ignore anything past the eighth symbol rather than
                    // letting the field disagree with the code we would send.
                    if (normalizeDeviceCode(e.target.value).isOverflowing) return
                    setInput(e.target.value)
                    setError(null)
                  }}
                  placeholder="H4KP-9TQR"
                  className={cn(
                    'w-full rounded-2xl bg-neutral-950 border px-5 py-4 font-mono text-2xl',
                    'tracking-[0.25em] uppercase text-white placeholder:text-neutral-700',
                    'outline-none focus:border-primary transition-colors disabled:opacity-50',
                    normalized.invalidChars.length > 0 || error
                      ? 'border-red-500/60'
                      : 'border-neutral-800',
                  )}
                />

                <div className="min-h-[2.5rem] space-y-2">
                  {normalized.invalidChars.length > 0 && (
                    <p className="text-xs text-red-400 leading-relaxed">
                      Codes never contain{' '}
                      <span className="font-mono">{normalized.invalidChars.join(' ')}</span>. If the
                      tablet looks like it is showing an <span className="font-mono">O</span> or an{' '}
                      <span className="font-mono">I</span>, it is a <span className="font-mono">0</span>{' '}
                      or a <span className="font-mono">1</span> — and neither of those is in a code
                      either. Have another look.
                    </p>
                  )}
                  {error && <p className="text-xs text-red-400 leading-relaxed">{error}</p>}
                  {!error && normalized.invalidChars.length === 0 && normalized.code.length > 0 && (
                    <p className="text-[10px] font-mono text-neutral-500">
                      {formatDeviceCode(normalized.code)}
                      {!normalized.isComplete && ` · ${CODE_LENGTH - normalized.code.length} to go`}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="inline-flex items-center justify-center gap-2 w-full px-6 py-3 rounded-xl bg-primary text-black text-sm font-bold tracking-tight disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 active:scale-[0.98] transition"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{submitting ? 'Linking…' : 'Link this tablet'}</span>
                </button>
              </form>
            </section>
          )}

          {stage === 'done' && (
            <section className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-[10px] font-mono tracking-wider text-emerald-400">
                <Check className="w-3.5 h-3.5" />
                <span>Tablet linked</span>
              </div>
              <h2 className="text-lg font-extrabold text-white tracking-tight">
                That is it — you can put this device down.
              </h2>
              <p className="text-xs text-text-muted leading-relaxed">
                The tablet checks in every few seconds, so it should show the account
                {email ? <span className="font-mono text-white"> {email}</span> : ''} within about
                ten seconds. If it is still waiting after a minute, make sure the tablet is on
                Wi-Fi and start again on the tablet for a fresh code.
              </p>
              <p className="text-xs text-text-muted leading-relaxed">
                The lists sync from the tablet from now on, and signing out there ends it. Nothing
                needs this page again unless you add another tablet.
              </p>
              <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 font-medium bg-neutral-950/40 border border-neutral-900/60 px-3 py-1.5 rounded-full w-fit">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Codes are single-use and expire in ten minutes</span>
              </div>
            </section>
          )}
        </main>

        <footer className="text-center text-[10px] text-neutral-600 font-mono pt-4">
          &copy; {new Date().getFullYear()} teddy.fyi. All rights reserved.
        </footer>
      </div>
    </div>
  )
}

export default DeviceLinkPage
