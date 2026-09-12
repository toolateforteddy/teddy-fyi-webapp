import { useNavigate } from 'react-router-dom'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { HELP_INTRO, HELP_SECTIONS, HELP_TABS } from '@/features/help/content'
import type { HelpBlock } from '@/features/help/content'
import { GestureCallout } from '@/features/help/components/GestureCallout'

/**
 * `/help` -- how to use this app, for the gestures that are invisible until somebody tells you.
 *
 * Public on purpose. It is static text about the app rather than anything belonging to an
 * account, it ships inside the bundle the service worker already precaches, and a link to it
 * is the kind of thing that gets pasted to somebody who has not signed in yet.
 *
 * It deliberately does not sit inside DashboardLayout: the layout's chrome is the very thing
 * being explained, and rendering it around the explanation invites the reader to poke at the
 * real controls in a nav bar that is only half-there.
 */
export function HelpPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-dvh bg-canvas text-text-primary flex justify-center font-sans antialiased">
      <div className="app-frame min-h-dvh bg-canvas flex flex-col border-x border-line-faint">
        <header className="app-chrome sticky top-0 z-40 shrink-0 h-14 px-2 flex items-center gap-1 bg-canvas/80 backdrop-blur-md border-b border-line-faint pt-[env(safe-area-inset-top)]">
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-lg text-text-muted hover:text-text-primary active:scale-95 transition-all cursor-pointer"
            aria-label="Back to list"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-bold tracking-wider text-text-primary">How this works</span>
        </header>

        <main className="app-scroll flex-1 px-4 py-5 pb-16 space-y-8">
          <section className="space-y-4">
            <p className="text-sm text-text-secondary leading-relaxed">{HELP_INTRO}</p>

            <div className="grid grid-cols-2 gap-2">
              {HELP_TABS.map(tab => (
                <div
                  key={tab.name}
                  className="bg-surface-tile border border-line-faint rounded-xl px-3 py-2.5"
                >
                  <span className="block text-sm font-bold text-text-primary">{tab.name}</span>
                  <span className="block text-[11px] text-text-muted leading-snug mt-0.5">
                    {tab.blurb}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {HELP_SECTIONS.map(section => (
            <section key={section.id} id={section.id} className="space-y-3">
              <h2 className="text-lg font-bold text-text-primary tracking-tight">{section.title}</h2>
              {section.blocks.map((block, index) => (
                <HelpBlockView key={index} block={block} />
              ))}
            </section>
          ))}

          <p className="text-[11px] text-text-faint pt-2 border-t border-line-faint">
            Everything here describes what this app does today. The Android app has its own
            gestures and its own help screen.
          </p>
        </main>
      </div>
    </div>
  )
}

function HelpBlockView({ block }: { block: HelpBlock }) {
  switch (block.kind) {
    case 'text':
      return <p className="text-sm text-text-secondary leading-relaxed">{block.body}</p>

    case 'gesture':
      return (
        <GestureCallout
          gesture={block.gesture}
          verb={block.verb}
          what={block.what}
          then={block.then}
        />
      )

    case 'rows':
      return (
        <dl className="border-t border-line-faint">
          {block.rows.map(row => (
            <div
              key={row.term}
              className="grid grid-cols-[minmax(0,1fr)] sm:grid-cols-[130px_minmax(0,1fr)] gap-x-4 py-2.5 border-b border-line-faint"
            >
              <dt className="text-xs font-semibold text-text-primary">{row.term}</dt>
              <dd className="text-xs text-text-muted leading-relaxed m-0">{row.detail}</dd>
            </div>
          ))}
        </dl>
      )

    case 'note':
      return block.tone === 'warn' ? (
        <div className="flex gap-2.5 rounded-xl border border-line p-3">
          <AlertTriangle className="w-4 h-4 shrink-0 text-pending mt-0.5" aria-hidden="true" />
          <p className="text-xs text-text-secondary leading-relaxed">{block.body}</p>
        </div>
      ) : (
        <div className="rounded-xl bg-surface-tile p-3">
          <p className="text-xs text-text-secondary leading-relaxed">{block.body}</p>
        </div>
      )
  }
}

export default HelpPage
