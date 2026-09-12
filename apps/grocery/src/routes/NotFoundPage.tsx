import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft, Terminal } from 'lucide-react'

/**
 * What an unmatched path lands on.
 *
 * This used to be `<Navigate to="/" replace />`, which made two very different
 * situations look identical: a genuinely wrong URL, and a *correct* URL that
 * the running bundle was simply too old to know about. The second is what a
 * stale cached index.html produces, and it cost an afternoon of reshipping a
 * `/link` route that was live the whole time — the browser was running the
 * previous app, where `/link` matched nothing.
 *
 * So say which path missed, and stay on it. A URL that survives the failure is
 * one you can hard-reload, and a page that names the path is one you can tell
 * apart from the landing page at a glance.
 */
export function NotFoundPage() {
  const { pathname } = useLocation()

  return (
    <div className="min-h-dvh bg-canvas text-text-primary flex flex-col items-center font-sans antialiased selection:bg-primary selection:text-on-primary">
      <div className="app-frame min-h-dvh bg-canvas flex flex-col border-x border-line-faint shadow-[var(--shadow-frame)] px-6 py-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] gap-8">

        <header className="flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-1 text-text-muted hover:text-text-primary transition-colors text-xs font-semibold"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </Link>
          <div className="flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-text-faint font-semibold">
            <Terminal className="w-3 h-3" />
            <span>teddy.fyi</span>
          </div>
        </header>

        <main className="flex-1 flex flex-col justify-center space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-raised border border-line text-[10px] font-mono tracking-wider text-primary w-fit">
            <span>404</span>
          </div>

          <h1 className="text-2xl font-black tracking-tight text-text-primary">Nothing at that address</h1>

          <p className="font-mono text-xs text-text-primary bg-inset border border-line rounded-xl px-4 py-3 break-all">
            {pathname}
          </p>

          <p className="text-xs text-text-muted leading-relaxed">
            Either the address is wrong, or this browser is running an older copy of the site that
            predates the page you are after. Reload with{' '}
            <span className="font-mono text-text-primary">Cmd</span>&nbsp;+&nbsp;
            <span className="font-mono text-text-primary">Shift</span>&nbsp;+&nbsp;
            <span className="font-mono text-text-primary">R</span> (or{' '}
            <span className="font-mono text-text-primary">Ctrl</span>&nbsp;+&nbsp;
            <span className="font-mono text-text-primary">Shift</span>&nbsp;+&nbsp;
            <span className="font-mono text-text-primary">R</span>) to fetch a fresh one before assuming
            the address is at fault.
          </p>

          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 w-full px-6 py-3 rounded-xl bg-primary text-on-primary text-sm font-bold tracking-tight hover:brightness-110 active:scale-[0.98] transition"
          >
            Go to the home page
          </Link>
        </main>

        <footer className="text-center text-[10px] text-text-faint font-mono pt-4">
          &copy; {new Date().getFullYear()} teddy.fyi. All rights reserved.
        </footer>
      </div>
    </div>
  )
}

export default NotFoundPage
