import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { ListChecks, MailCheck } from 'lucide-react'
import LoginForm from '@/features/auth/components/LoginForm'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { fetchInviteState, type InviteState } from '@/features/invite/todoInvite'

/**
 * `/login`.
 *
 * Google sign-in is always offered: anybody with a teddy.fyi account gets in, and the API is
 * what refuses a person with no account and no invite (see `LoginForm` for how that refusal
 * reads). The invite this browser holds, if any, is asked for alongside and only adds a line
 * naming the address it is for, so the right Google account is picked. It never holds the
 * button back, so an unreachable status check costs nothing.
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
          <h1 className="text-2xl font-black tracking-tight">Todo</h1>

          <div className="w-full bg-surface-tile border border-line-faint rounded-2xl p-6 flex flex-col items-center gap-4">
            {invite?.kind === 'invited' && (
              <p className="flex items-center gap-2 text-xs text-text-secondary">
                <MailCheck className="w-4 h-4 text-success" />
                <span>
                  Sign in with Google as <strong>{invite.invite.email}</strong>
                </span>
              </p>
            )}
            <LoginForm invitedEmail={invite?.kind === 'invited' ? invite.invite.email : undefined} />
          </div>
        </main>
      </div>
    </div>
  )
}

export default LoginPage
