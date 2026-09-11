import { AlertCircle, RefreshCw, RotateCcw, LogOut } from 'lucide-react'
import { useAuth } from '@/features/auth/hooks/useAuth'

interface BootstrapFailureProps {
  /** Puts the shell back into `loading` and runs the first sync again. */
  onRetry: () => void
}

/**
 * What the shell shows when it has no list to show.
 *
 * This replaces an unbounded spinner, so its job is to be the opposite of one: say that
 * the app has stopped waiting, and give the user something to press. The three actions
 * are in the order of how much they cost, because the cheapest one fixes most of it --
 * the usual cause is a sync that could not reach the server, and the usual fix is trying
 * it again once there is signal.
 *
 * "Reset the cached app" is `?sw=off`, the kill switch documented in `pwa.ts` and on the
 * /help page. It is here rather than only in the docs because the device that needs it is
 * the device that cannot read anything else the app renders: a service worker serving a
 * bundle old enough to be broken will keep serving it through every ordinary reload.
 */
export function BootstrapFailure({ onRetry }: BootstrapFailureProps) {
  const { logout } = useAuth()

  return (
    <div className="h-dvh bg-black text-white flex justify-center font-sans antialiased">
      <div className="app-frame app-shell h-dvh bg-black flex flex-col items-center justify-center border-x border-[#1a1a1a] shadow-[0_0_50px_0_rgba(208,188,255,0.05)] px-6 text-center overflow-y-auto">
        <AlertCircle className="w-10 h-10 text-amber-500 shrink-0" aria-hidden="true" />

        <h1 className="mt-5 text-lg font-semibold">Your lists did not load</h1>
        <p className="mt-2 text-sm text-text-muted max-w-xs">
          The app could not reach the server, so it has nothing to show yet. Anything you
          have already added is still saved on this device.
        </p>

        <div className="mt-7 w-full max-w-xs space-y-3">
          <button
            type="button"
            onClick={onRetry}
            className="w-full h-11 rounded-xl bg-primary text-black font-medium text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Try again
          </button>

          <a
            href="/?sw=off"
            className="w-full h-11 rounded-xl border border-[#2a2a2a] text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            Reset the cached app
          </a>

          <button
            type="button"
            onClick={() => { void logout() }}
            className="w-full h-11 rounded-xl text-sm text-text-muted flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            Sign out
          </button>
        </div>

        <p className="mt-7 text-xs text-text-muted max-w-xs">
          Resetting clears the saved copy of the app and loads it fresh. Your lists live on
          the server and come back when it does.
        </p>
      </div>
    </div>
  )
}

export default BootstrapFailure
