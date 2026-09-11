import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { useAppLayout } from '../useAppLayout'

type Listener = () => void

/**
 * Minimal matchMedia stand-in: jsdom ships none at all, which is why the hook
 * has to survive its absence. `matches` is decided by a predicate over the
 * query string so a test can flip orientation and re-notify listeners.
 */
function installMatchMedia(matches: (query: string) => boolean) {
  const listeners = new Set<Listener>()

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      media: query,
      get matches() {
        return matches(query)
      },
      addEventListener: (_: string, cb: Listener) => listeners.add(cb),
      removeEventListener: (_: string, cb: Listener) => listeners.delete(cb),
      addListener: (cb: Listener) => listeners.add(cb),
      removeListener: (cb: Listener) => listeners.delete(cb),
      dispatchEvent: () => true,
    }),
  })

  return {
    /** Re-point the predicate and tell every subscriber the world changed. */
    set(next: (query: string) => boolean) {
      matches = next
      act(() => {
        listeners.forEach(cb => cb())
      })
    },
  }
}

function Probe() {
  const { nav, compact } = useAppLayout()
  return <span data-testid="layout">{`${nav}:${compact}`}</span>
}

function WideProbe() {
  const { nav, railLabels, wide, dockAddPane } = useAppLayout()
  return <span data-testid="wide">{`${nav}:${railLabels}:${wide}:${dockAddPane}`}</span>
}

/**
 * The stubs above answer per query string, so a "viewport" here is just the set
 * of queries a browser of that size would report as matching. Spelling them out
 * rather than pattern-matching on substrings is what keeps a test honest about
 * queries that cannot both be true -- (max-height: 560px) and (min-height: 561px)
 * being the pair this hook now leans on.
 */
const VIEWPORTS = {
  /** 390x844, the phone the layout is designed around: nothing here matches. */
  phonePortrait: () => false,
  /** 844x390: wide enough for the tablet queries, too short for them. */
  phoneLandscape: (query: string) =>
    query.includes('orientation: landscape') || query.includes('max-height: 560px'),
  /** 768x1024, a tablet held upright. */
  tabletPortrait: (query: string) => query.includes('min-width: 600px') && !query.includes('1000px'),
  /** 1440x900, a laptop. */
  desktop: (query: string) => query.includes('min-width'),
} as const

afterEach(() => {
  // @ts-expect-error -- deliberately restoring the jsdom default of "absent".
  delete window.matchMedia
  vi.restoreAllMocks()
})

describe('useAppLayout', () => {
  it('falls back to the portrait layout when matchMedia is unavailable', () => {
    render(<Probe />)
    expect(screen.getByTestId('layout')).toHaveTextContent('bottom:false')
  })

  it('keeps the bottom bar on a tall viewport', () => {
    installMatchMedia(() => false)
    render(<Probe />)
    expect(screen.getByTestId('layout')).toHaveTextContent('bottom:false')
  })

  it('moves navigation to a rail when the viewport is short and landscape', () => {
    installMatchMedia(() => true)
    render(<Probe />)
    expect(screen.getByTestId('layout')).toHaveTextContent('rail:true')
  })

  it('compacts the header on a short viewport without moving the bar in portrait', () => {
    // Short, but portrait: only the height query matches. The rail query also
    // requires landscape, and the tablet queries require the opposite height.
    installMatchMedia(query => query === '(max-height: 560px)')
    render(<Probe />)
    expect(screen.getByTestId('layout')).toHaveTextContent('bottom:true')
  })

  it('leaves a phone on the bottom bar in either orientation', () => {
    const media = installMatchMedia(VIEWPORTS.phonePortrait)
    render(<WideProbe />)
    expect(screen.getByTestId('wide')).toHaveTextContent('bottom:false:false:false')

    // Turned sideways it is wider than the 600px tablet breakpoint, which is
    // exactly what the height half of that query is there to catch: the rail it
    // gets is the short-viewport one, unlabelled, and the shell does not widen.
    media.set(VIEWPORTS.phoneLandscape)
    expect(screen.getByTestId('wide')).toHaveTextContent('rail:false:false:false')
  })

  it('gives a tablet a labelled rail but keeps the add form in a sheet', () => {
    installMatchMedia(VIEWPORTS.tabletPortrait)
    render(<WideProbe />)
    expect(screen.getByTestId('wide')).toHaveTextContent('rail:true:true:false')
  })

  it('docks the add form once there is room for it beside the list', () => {
    installMatchMedia(VIEWPORTS.desktop)
    render(<WideProbe />)
    expect(screen.getByTestId('wide')).toHaveTextContent('rail:true:true:true')
  })

  it('re-renders when the device is rotated', () => {
    const media = installMatchMedia(() => false)
    render(<Probe />)
    expect(screen.getByTestId('layout')).toHaveTextContent('bottom:false')

    media.set(() => true)
    expect(screen.getByTestId('layout')).toHaveTextContent('rail:true')
  })
})
