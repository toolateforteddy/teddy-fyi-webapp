import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { useOnlineStatus } from '../useOnlineStatus'

function Probe() {
  return <span data-testid="state">{useOnlineStatus() ? 'online' : 'offline'}</span>
}

/** jsdom's navigator.onLine is a getter, so it has to be redefined rather than set. */
function setOnLine(value: boolean | undefined) {
  Object.defineProperty(window.navigator, 'onLine', { value, configurable: true })
}

afterEach(() => {
  setOnLine(true)
})

describe('useOnlineStatus', () => {
  it('reports the real value on the very first render', () => {
    setOnLine(false)

    render(<Probe />)

    expect(screen.getByTestId('state').textContent).toBe('offline')
  })

  it('follows the browser going offline and coming back', () => {
    setOnLine(true)
    render(<Probe />)

    act(() => {
      setOnLine(false)
      window.dispatchEvent(new Event('offline'))
    })
    expect(screen.getByTestId('state').textContent).toBe('offline')

    act(() => {
      setOnLine(true)
      window.dispatchEvent(new Event('online'))
    })
    expect(screen.getByTestId('state').textContent).toBe('online')
  })

  // Some embedded webviews do not implement it at all. Claiming an outage that is
  // not there is worse than missing one that is.
  it('assumes connected where navigator.onLine does not exist', () => {
    setOnLine(undefined)

    render(<Probe />)

    expect(screen.getByTestId('state').textContent).toBe('online')
  })

  it('stops listening once the last consumer unmounts', () => {
    const { unmount } = render(<Probe />)
    unmount()

    // No listener left to update an unmounted tree: React warns if one fires.
    expect(() => {
      setOnLine(false)
      window.dispatchEvent(new Event('offline'))
    }).not.toThrow()
  })
})
