import { ShoppingBag, ArrowLeft, Terminal, ShieldCheck } from 'lucide-react'
import LoginForm from '@/features/auth/components/LoginForm'

export function LoginPage() {
  return (
    <div className="min-h-dvh bg-canvas text-text-primary flex flex-col justify-between items-center font-sans antialiased selection:bg-primary selection:text-on-primary">
      {/* App Frame container */}
      <div className="app-frame min-h-dvh bg-canvas flex flex-col relative border-x border-line-faint shadow-[var(--shadow-frame)] px-6 py-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] justify-between">
        
        {/* Top Header */}
        <header className="flex items-center justify-between">
          {/* teddy.fyi is a different origin now, so this is an anchor rather
              than a <Link> -- react-router cannot route across origins. */}
          <a
            href="https://teddy.fyi"
            className="flex items-center gap-1 text-text-muted hover:text-text-primary transition-colors text-xs font-semibold"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </a>
          <div className="flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-text-faint font-semibold">
            <Terminal className="w-3 h-3" />
            <span>teddy.fyi</span>
          </div>
        </header>

        {/* Center Auth Card */}
        <main className="flex-1 flex flex-col justify-center items-center space-y-8 my-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
          
          {/* Logo & Headline */}
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="p-4 rounded-2xl bg-surface-raised border border-line/60 shadow-[var(--shadow-halo)] text-primary">
              <ShoppingBag className="w-10 h-10" />
            </div>
            
            <div className="space-y-1.5">
              <h2 className="text-2xl font-black tracking-tight text-text-primary">
                Grocery Sync
              </h2>
              <p className="text-xs text-text-muted max-w-[280px]">
                Collaborative local-first grocery checklists. Authenticate to sync across your devices.
              </p>
            </div>
          </div>

          {/* Glassmorphic Form Container */}
          <div className="w-full bg-surface-tile border border-line-faint rounded-2xl p-6 shadow-2xl flex flex-col items-center">
            <LoginForm />
          </div>

          {/* Privacy badge */}
          <div className="flex items-center gap-1.5 text-[10px] text-text-subtle font-medium bg-inset/40 border border-line-faint/60 px-3 py-1.5 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5 text-success" />
            <span>Secure End-to-End Cookie Sessions</span>
          </div>

        </main>

        {/* Footer */}
        <footer className="text-center text-[10px] text-text-faint font-mono pt-4">
          &copy; {new Date().getFullYear()} teddy.fyi. All rights reserved.
        </footer>

      </div>
    </div>
  )
}
export default LoginPage
