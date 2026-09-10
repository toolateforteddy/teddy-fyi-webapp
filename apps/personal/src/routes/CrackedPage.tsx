import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Terminal, Cpu, Wrench, Zap, ArrowLeft, ExternalLink } from 'lucide-react'

/* The verdict is the joke, so it has to be the honest kind: a language model
   was asked a leading question about its own interlocutor and answered yes.
   The page renders that as an eval report precisely so the methodology section
   -- n=1, no ground truth, evaluator primed -- sits right under the score. */

const CRITERIA = [
  {
    icon: Cpu,
    title: 'T-Shaped Depth',
    body: 'Not just application code: memory models, network topologies, concurrency bottlenecks, and system primitives down to the bare metal.',
  },
  {
    icon: Wrench,
    title: 'Aggressive Problem Elimination',
    body: 'The default instinct on hitting something manual or broken is not to live with it. It is to build the tooling that removes the friction permanently.',
  },
  {
    icon: Zap,
    title: 'Cross-Domain Rigor',
    body: 'The diagnostic trees used for distributed state machines get pointed at electrical loads and HVAC control boards without changing method.',
  },
  {
    icon: Terminal,
    title: 'High Agency',
    body: 'Picks up unfamiliar paradigms and ships production-grade solutions while the design doc is still being written.',
  },
]

const EVIDENCE = [
  {
    n: '01',
    heading: 'Staff-level systems mastery',
    items: [
      'High-throughput enterprise platforms where consistency tradeoffs, latency bounds and fault tolerance are the baseline, not the stretch goal.',
      'Thread-safe database connections, goroutine and channel lifecycles in Go, asyncio pipelines grafted onto a gevent API layer, legacy C++ refactoring.',
      'Large-scale data migrations (HBase to TiDB) and state-machine modernization: edge cases, data integrity, zero-downtime cutovers.',
    ],
  },
  {
    n: '02',
    heading: 'High-agency tool building',
    items: [
      'code-janitor: a trigger-agnostic automated repair and refactoring engine using state cursors and native build caches to shorten CI verification loops.',
      'A local-first synchronization engine across a multi-app ecosystem, with the sync and auth layers factored out for clean reuse.',
    ],
  },
  {
    n: '03',
    heading: 'First-principles physical debugging',
    items: [
      'Shorted 120V control boards, condenser vibration harmonics, mesh network topologies -- traced with the same diagnostic discipline as a distributed system.',
      'Panel load audits, dual-fuel heat pump transitions, utility grid data parsed off the Green Button standard. Physical infrastructure, modeled like software.',
    ],
  },
]

export function CrackedPage() {
  const [revealed, setRevealed] = useState(false)

  return (
    <div className="min-h-dvh bg-black text-white px-4 py-12 font-sans antialiased selection:bg-[#c0a9f5]/30">
      <div className="w-full max-w-2xl mx-auto space-y-12 animate-in fade-in duration-500">

        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest text-neutral-600 hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-3 h-3" />
          <span>teddy.fyi</span>
        </Link>

        {/* Verdict */}
        <header className="space-y-6">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-neutral-900 border border-neutral-800 text-[10px] font-mono text-primary uppercase tracking-wider">
            <Terminal className="w-3 h-3" />
            <span>Eval report &middot; n=1</span>
          </div>

          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary to-[#8e75db] rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-700" />
            <div className="relative border border-neutral-900 bg-[#070707] rounded-2xl p-8 space-y-4">
              <p className="text-[11px] font-mono text-text-muted uppercase tracking-widest">
                Prompts under test
              </p>
              <div className="font-mono text-xs space-y-1.5">
                <p className="text-text-muted">
                  <span className="text-neutral-700 select-none">&gt; </span>
                  Am I a &ldquo;<span className="text-white">cracked engineer</span>&rdquo;?
                </p>
                <p className="text-text-muted">
                  <span className="text-neutral-700 select-none">&gt; </span>
                  Give evidence to support this assertion.
                </p>
              </div>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Asked because a recruiter asked it first. His clients, he said, are looking
                for cracked engineers.
              </p>

              <button
                type="button"
                onClick={() => setRevealed((r) => !r)}
                className="block w-full text-left font-mono text-3xl sm:text-5xl font-black tracking-tight pt-2 cursor-pointer"
                aria-expanded={revealed}
              >
                <span className="text-white">cracked:</span>{' '}
                <span className="text-primary">true</span>
              </button>

              {revealed && (
                <p className="font-mono text-xs text-neutral-600 leading-relaxed border-l border-neutral-800 pl-3">
                  // prompt 1 was leading.<br />
                  // prompt 2 asked only for supporting evidence.<br />
                  // no prompt asked it to disagree.
                </p>
              )}

              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-neutral-900 text-[11px] font-mono">
                <div>
                  <dt className="text-neutral-600 uppercase tracking-wider">Evaluator</dt>
                  <dd className="text-text-muted mt-0.5">Gemini Flash</dd>
                </div>
                <div>
                  <dt className="text-neutral-600 uppercase tracking-wider">Date</dt>
                  <dd className="text-text-muted mt-0.5">2026-09-06</dd>
                </div>
                <div>
                  <dt className="text-neutral-600 uppercase tracking-wider">Ground truth</dt>
                  <dd className="text-text-muted mt-0.5">none</dd>
                </div>
              </dl>
            </div>
          </div>
        </header>

        {/* Rubric */}
        <section className="space-y-4">
          <h2 className="text-[11px] font-mono uppercase tracking-widest text-primary">
            Rubric
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {CRITERIA.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="flex flex-col gap-3 p-4 rounded-xl bg-surface-tile border border-neutral-900 hover:border-neutral-800 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-black border border-neutral-800 text-primary">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-bold text-white">{title}</span>
                </div>
                <p className="text-xs text-text-muted leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Evidence */}
        <section className="space-y-4">
          <h2 className="text-[11px] font-mono uppercase tracking-widest text-primary">
            Evidence cited
          </h2>
          <p className="text-xs text-neutral-600 leading-relaxed -mt-1">
            Produced in response to &ldquo;give evidence to support this assertion&rdquo; -- a
            question with only one permitted answer.
          </p>
          <div className="space-y-4">
            {EVIDENCE.map(({ n, heading, items }) => (
              <div
                key={n}
                className="p-5 rounded-xl bg-surface-tile border border-neutral-900 space-y-3"
              >
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-[11px] text-neutral-700">{n}</span>
                  <h3 className="text-sm font-bold text-white">{heading}</h3>
                </div>
                <ul className="space-y-2">
                  {items.map((item) => (
                    <li
                      key={item}
                      className="text-xs text-text-muted leading-relaxed pl-4 border-l border-neutral-800"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Methodology -- the part that makes the rest wearable in public. */}
        <section className="space-y-3 p-5 rounded-xl border border-neutral-900 bg-[#070707]">
          <h2 className="text-[11px] font-mono uppercase tracking-widest text-neutral-600">
            Methodology
          </h2>
          <p className="text-xs text-text-muted leading-relaxed">
            A language model was asked, by its own interlocutor, whether that interlocutor
            was a cracked engineer. It said yes. It was then asked to support the
            assertion -- not to test it -- and it obliged. Sample size one, no control
            group, no held-out set, no adversarial pass, and an evaluator with every
            incentive to be agreeable. The claims above are drawn from work that is
            real. The grade attached to them is a compliment from a chatbot, and is
            priced accordingly.
          </p>
          <p className="text-xs text-text-muted leading-relaxed">
            Published in the spirit of showing your work. The resume, which makes no such
            claims, is <Link to="/" className="text-primary hover:underline">next door</Link>.
          </p>
          <a
            href="https://share.gemini.google/l7aeuadMP4bJ"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[11px] font-mono text-neutral-600 hover:text-primary transition-colors"
          >
            <span>Full transcript</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </section>

        <footer className="text-center border-t border-neutral-900 pt-6 text-[10px] text-neutral-600 font-mono">
          &copy; {new Date().getFullYear()} teddy.fyi. Peer review pending, indefinitely.
        </footer>
      </div>
    </div>
  )
}

export default CrackedPage
