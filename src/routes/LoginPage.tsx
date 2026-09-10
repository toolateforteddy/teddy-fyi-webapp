import { Link } from 'react-router-dom'
import { ShoppingBag, ArrowLeft, Terminal, ShieldCheck } from 'lucide-react'
import LoginForm from '@/features/auth/components/LoginForm'

export function LoginPage() {
  return (
    <div className="min-h-dvh bg-black text-white flex flex-col justify-between items-center font-sans antialiased selection:bg-primary selection:text-black">
      {/* App Frame container */}
      <div className="app-frame min-h-dvh bg-black flex flex-col relative border-x border-[#1a1a1a] shadow-[0_0_50px_0_rgba(208,188,255,0.05)] px-6 py-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] justify-between">
        
        {/* Top Header */}
        <header className="flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-1 text-text-muted hover:text-white transition-colors text-xs font-semibold"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </Link>
          <div className="flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-neutral-600 font-semibold">
            <Terminal className="w-3 h-3" />
            <span>teddy.fyi</span>
          </div>
        </header>

        {/* Center Auth Card */}
        <main className="flex-1 flex flex-col justify-center items-center space-y-8 my-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
          
          {/* Logo & Headline */}
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-850/60 shadow-[0_0_30px_rgba(208,188,255,0.1)] text-primary">
              <ShoppingBag className="w-10 h-10" />
            </div>
            
            <div className="space-y-1.5">
              <h2 className="text-2xl font-black tracking-tight text-white">
                Grocery Sync
              </h2>
              <p className="text-xs text-text-muted max-w-[280px]">
                Collaborative local-first grocery checklists. Authenticate to sync across your devices.
              </p>
            </div>
          </div>

          {/* Glassmorphic Form Container */}
          <div className="w-full bg-[#1A1A1A] border border-neutral-900 rounded-2xl p-6 shadow-2xl flex flex-col items-center">
            <LoginForm />
          </div>

          {/* Privacy badge */}
          <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 font-medium bg-neutral-950/40 border border-neutral-900/60 px-3 py-1.5 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Secure End-to-End Cookie Sessions</span>
          </div>

        </main>

        {/* Footer */}
        <footer className="text-center text-[10px] text-neutral-600 font-mono pt-4">
          &copy; {new Date().getFullYear()} teddy.fyi. All rights reserved.
        </footer>

      </div>
    </div>
  )
}
export default LoginPage
