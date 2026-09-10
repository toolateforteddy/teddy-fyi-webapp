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
    // Short, but portrait: the height query matches while the rail query (which
    // also requires landscape) does not.
    installMatchMedia(query => !query.includes('orientation'))
    render(<Probe />)
    expect(screen.getByTestId('layout')).toHaveTextContent('bottom:true')
  })

  it('re-renders when the device is rotated', () => {
    const media = installMatchMedia(() => false)
    render(<Probe />)
    expect(screen.getByTestId('layout')).toHaveTextContent('bottom:false')

    media.set(() => true)
    expect(screen.getByTestId('layout')).toHaveTextContent('rail:true')
  })
})
