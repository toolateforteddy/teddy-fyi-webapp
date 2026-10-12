import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Loader2, MailX } from 'lucide-react'
import { admitInvite, inviteCodeFromRouteParam, type AdmitFailure } from '@/features/invite/todoInvite'

/**
 * `/invite/:code` — where an invite link lands.
 *
 * Its one job is to hand the code to the API, which holds it in this browser's cookie, and
 * then send the recipient on to `/login`, which now knows they are invited and offers Google.
 * Nothing is signed in here: the invite is only checked against an address at sign-in, and
 * the cookie is what carries it there — across the Google round trip, a closed tab, and an
 * install from this browser.
 *
 * Opening it again is harmless, and so is opening it while signed in: the cookie is replaced
 * with the same code.
 */
export function InvitePage() {
  const { code: param } = useParams<{ code: string }>()
  const code = inviteCodeFromRouteParam(param)
  const navigate = useNavigate()
  const [failure, setFailure] = useState<AdmitFailure | null>(null)

  useEffect(() => {
    if (!code) return
    let cancelled = false
    admitInvite(code).then((result) => {
      if (cancelled) return
      if (result.ok) navigate('/login', { replace: true })
      else setFailure(result.reason)
    })
    return () => {
      cancelled = true
    }
  }, [code, navigate])

  if (code === null && param === undefined) return <Navigate to="/login" replace />

  return (
    <div className="min-h-dvh bg-canvas text-text-primary flex flex-col items-center font-sans antialiased">
      <div className="app-frame min-h-dvh bg-canvas flex flex-col border-x border-line-faint px-6 justify-center">
        <main className="flex flex-col items-center text-center space-y-5">
          {code && !failure ? (
            <>
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-xs text-text-muted">Opening your invite...</p>
            </>
          ) : (
            <>
              <MailX className="w-9 h-9 text-danger" />
              <h1 className="text-xl font-black tracking-tight">
                {failure === 'unreachable' ? "Couldn't open the invite" : "This invite link doesn't work"}
              </h1>
              <p className="text-xs text-text-muted max-w-[300px]">
                {failure === 'unreachable'
                  ? 'The server could not be reached. Check your connection and open the link again.'
                  : !code
                    ? 'The code at the end of it is missing or was cut short. Ask whoever invited you to send it again.'
                    : 'It may have expired. Ask whoever invited you for a fresh link.'}
              </p>
            </>
          )}
        </main>
      </div>
    </div>
  )
}

export default InvitePage
