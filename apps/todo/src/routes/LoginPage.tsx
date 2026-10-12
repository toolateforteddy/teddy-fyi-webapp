import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { ListChecks, Loader2, Lock, MailCheck } from 'lucide-react'
import LoginForm from '@/features/auth/components/LoginForm'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { fetchInviteState, type InviteState } from '@/features/invite/todoInvite'

/**
 * `/login`, for an app that is invite-only.
 *
 * Asks the API which invite this browser holds before it offers anything. With none, the
 * API refuses every sign-in from this origin, so the page says so rather than drawing a
 * Google button that can only lead to a refusal. With one, it names the address so the right
 * Google account is picked. If the API cannot be reached it offers the button anyway: the
 * sign-in itself is the check, and refusing somebody who is invited is the worse mistake.
 */
export function LoginPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const [invite, setInvite] = useState<InviteState | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchInviteState().then((state) => {
      if (!cancelled) setInvite(state)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!isLoading && isAuthenticated) return <Navigate to="/" replace />

  return (
    <div className="min-h-dvh bg-canvas text-text-primary flex flex-col items-center font-sans antialiased">
      <div className="app-frame min-h-dvh bg-canvas flex flex-col border-x border-line-faint px-6 py-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] justify-center">
        <main className="flex flex-col items-center text-center space-y-7">
          <div className="p-4 rounded-2xl bg-surface-raised border border-line/60 text-primary">
            <ListChecks className="w-10 h-10" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-2xl font-black tracking-tight">Todo</h1>
            <p className="text-xs text-text-muted max-w-[300px]">
              Your teddy.fyi todo list, synced with the Android app.
            </p>
          </div>

          {invite === null ? (
            <Loader2 className="w-5 h-5 text-text-muted animate-spin" />
          ) : invite.kind === 'none' ? (
            <NotInvited />
          ) : (
            <div className="w-full bg-surface-tile border border-line-faint rounded-2xl p-6 flex flex-col items-center gap-4">
              {invite.kind === 'invited' && (
                <p className="flex items-center gap-2 text-xs text-text-secondary">
                  <MailCheck className="w-4 h-4 text-success" />
                  <span>
                    Invited as <strong>{invite.invite.email}</strong>
                  </span>
                </p>
              )}
              <LoginForm invitedEmail={invite.kind === 'invited' ? invite.invite.email : undefined} />
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

function NotInvited() {
  return (
    <div className="w-full bg-surface-tile border border-line-faint rounded-2xl p-6 flex flex-col items-center gap-3">
      <Lock className="w-6 h-6 text-text-muted" />
      <p className="text-sm font-semibold">Todo on the web is invite-only</p>
      <p className="text-xs text-text-muted max-w-[280px]">
        Open the invite link you were sent, in this browser. If you install the app, install it
        from the same browser you opened the link in.
      </p>
    </div>
  )
}

export default LoginPage
