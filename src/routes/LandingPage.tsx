import { Link } from 'react-router-dom'
import { FileText, ArrowRight, Sparkles, Code2, BookOpen } from 'lucide-react'
import { useAuth } from '@/features/auth/hooks/useAuth'

export function LandingPage() {
  const { isAuthenticated } = useAuth()
  return (
    <div className="min-h-dvh bg-black text-white flex flex-col justify-between items-center px-4 py-12 font-sans antialiased selection:bg-[#c0a9f5]/30">

      {/* Hidden Home Link matching class="home" display="none" */}
      <Link to="/" className="sr-only" aria-hidden="true">Home</Link>

      {/* Main Container */}
      <main className="w-full max-w-2xl flex-1 flex flex-col justify-center items-center space-y-12 animate-in fade-in duration-500">

        {/* Header Block with Logo */}
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-[#8e75db] rounded-full blur opacity-30 group-hover:opacity-70 transition duration-700"></div>
            <Link to="/" className="relative block w-24 h-24 rounded-full overflow-hidden border-2 border-neutral-800 group-hover:border-primary transition-colors duration-300">
              <img
                src="/images/face_small.jpg"
                alt="teddy"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            </Link>
          </div>

          <div className="space-y-2">
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight font-mono text-white">
              Teddy!
            </h1>
            <p className="text-sm font-semibold tracking-widest font-mono text-primary uppercase">
              Staff Systems Engineer
            </p>
            {/* Deliberately understated: the joke only works if you have to go look. */}
            <Link
              to="/cracked"
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-neutral-900 border border-neutral-800 text-[10px] font-mono text-neutral-500 hover:text-primary hover:border-neutral-700 transition-colors"
            >
              <span>cracked: true</span>
              <span className="text-neutral-700">*</span>
            </Link>
            <div className="space-y-4 text-sm text-text-muted max-w-md mx-auto leading-relaxed">
              <p>
                I am a Staff Systems Engineer with 15 years of experience architecting distributed systems, optimizing high-throughput data paths, and building infrastructure that scales predictably.
              </p>
              <p>
                I specialize in identifying and modernizing overlooked linchpins in enterprise systems, bringing them up to rigorous engineering standards with a focus on developer experience and fault tolerance.
              </p>
            </div>
          </div>
        </div>

        {/* Links Column / Grid */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4">

          <a
            href="/resume"
            className="flex items-center gap-4 p-4 rounded-xl bg-surface-tile border border-neutral-900 hover:border-neutral-800 hover:bg-neutral-900/40 transition-all group cursor-pointer"
          >
            <div className="p-3 rounded-lg bg-black border border-neutral-800 text-text-muted group-hover:text-primary transition-colors">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <span className="block text-sm font-bold text-white group-hover:text-primary transition-colors">My Resume</span>
              <span className="block text-xs text-text-muted mt-0.5">Professional career timeline & skills</span>
            </div>
          </a>

          <Link
            to="/articles"
            className="flex items-center gap-4 p-4 rounded-xl bg-surface-tile border border-neutral-900 hover:border-neutral-800 hover:bg-neutral-900/40 transition-all group cursor-pointer"
          >
            <div className="p-3 rounded-lg bg-black border border-neutral-800 text-text-muted group-hover:text-primary transition-colors">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <span className="block text-sm font-bold text-white group-hover:text-primary transition-colors">Articles I Like</span>
              <span className="block text-xs text-text-muted mt-0.5">Seminal papers & technical essays</span>
            </div>
          </Link>

          <a
            href="https://github.com/toolateforteddy"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 p-4 rounded-xl bg-surface-tile border border-neutral-900 hover:border-neutral-800 hover:bg-neutral-900/40 transition-all group cursor-pointer"
          >
            <div className="p-3 rounded-lg bg-black border border-neutral-800 text-text-muted group-hover:text-primary transition-colors">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <span className="block text-sm font-bold text-white group-hover:text-primary transition-colors">My Github</span>
              <span className="block text-xs text-text-muted mt-0.5">Explore open source codebases</span>
            </div>
          </a>

          <a
            href="https://www.linkedin.com/in/teddydmartin/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 p-4 rounded-xl bg-surface-tile border border-neutral-900 hover:border-neutral-800 hover:bg-neutral-900/40 transition-all group cursor-pointer"
          >
            <div className="p-3 rounded-lg bg-black border border-neutral-800 text-text-muted group-hover:text-primary transition-colors">
              <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                <rect x="2" y="9" width="4" height="12" />
                <circle cx="4" cy="4" r="2" />
              </svg>
            </div>
            <div>
              <span className="block text-sm font-bold text-white group-hover:text-primary transition-colors">My LinkedIn</span>
              <span className="block text-xs text-text-muted mt-0.5">Professional network & connections</span>
            </div>
          </a>

        </div>

        {/* Sync App Launcher block */}
        <div className="w-full relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-[#8e75db] rounded-2xl blur opacity-25 group-hover:opacity-45 transition duration-500"></div>
          <div className="relative border border-neutral-900 bg-[#070707] hover:border-neutral-850 p-6 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-6 transition-all duration-300">
            <div className="space-y-1.5 text-center sm:text-left">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-neutral-900 border border-neutral-800 text-[10px] font-mono text-primary uppercase tracking-wider">
                <Sparkles className="w-3 h-3" />
                <span>Grocery Sync Client</span>
              </div>
              <p className="text-sm font-bold text-white">Collaborative Sync App</p>
              <p className="text-xs text-text-muted max-w-sm">Access the secure cloud-synced collaborative grocery application.</p>
            </div>
            <Link
              to="/grocery"
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-primary hover:bg-[#c0a9f5] text-black font-bold text-xs py-3 px-5 rounded-lg active:scale-95 transition-all shadow-[0_0_20px_rgba(208,188,255,0.15)] cursor-pointer"
            >
              <span>{isAuthenticated ? 'Go to App' : 'Authenticate & Launch'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="w-full max-w-2xl text-center border-t border-neutral-900 pt-6 mt-8 text-[10px] text-neutral-600 font-mono">
        &copy; {new Date().getFullYear()} teddy.fyi. All rights reserved.
      </footer>
    </div>
  )
}

export default LandingPage
