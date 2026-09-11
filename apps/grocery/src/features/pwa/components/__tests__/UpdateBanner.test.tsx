import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UpdateBanner } from '../UpdateBanner'

const applyUpdate = vi.fn()
let notify: ((ready: boolean) => void) | null = null

vi.mock('@/pwa', () => ({
  subscribeToUpdates: (listener: (ready: boolean) => void) => {
    notify = listener
    listener(false)
    return () => {
      notify = null
    }
  },
  applyUpdate: () => applyUpdate(),
}))

/** Stand in for the worker announcing that a new version has finished installing. */
function announceUpdate() {
  notify?.(true)
}

beforeEach(() => {
  vi.clearAllMocks()
  notify = null
})

describe('UpdateBanner', () => {
  it('renders nothing until there is an update', () => {
    const { container } = render(<UpdateBanner />)

    expect(container).toBeEmptyDOMElement()
  })

  it('appears when a new version is ready', async () => {
    const { rerender } = render(<UpdateBanner />)
    announceUpdate()
    rerender(<UpdateBanner />)

    expect(await screen.findByText('A new version is ready.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
  })

  it('applies the update when reload is pressed', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<UpdateBanner />)
    announceUpdate()
    rerender(<UpdateBanner />)

    await user.click(await screen.findByRole('button', { name: 'Reload' }))

    expect(applyUpdate).toHaveBeenCalledTimes(1)
  })

  it('will not fire a second reload while the first is under way', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<UpdateBanner />)
    announceUpdate()
    rerender(<UpdateBanner />)

    const reload = await screen.findByRole('button', { name: 'Reload' })
    await user.click(reload)
    expect(await screen.findByRole('button', { name: 'Reloading...' })).toBeDisabled()

    expect(applyUpdate).toHaveBeenCalledTimes(1)
  })

  // Dismissing hides the banner and nothing else: the worker stays waiting and
  // still takes over at the next cold launch.
  it('can be dismissed, and does not apply the update when it is', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<UpdateBanner />)
    announceUpdate()
    rerender(<UpdateBanner />)

    await user.click(await screen.findByRole('button', { name: 'Dismiss until the next launch' }))

    expect(screen.queryByText('A new version is ready.')).not.toBeInTheDocument()
    expect(applyUpdate).not.toHaveBeenCalled()
  })

  it('stays dismissed if the worker announces the same update again', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<UpdateBanner />)
    announceUpdate()
    rerender(<UpdateBanner />)
    await user.click(await screen.findByRole('button', { name: 'Dismiss until the next launch' }))

    announceUpdate()
    rerender(<UpdateBanner />)

    expect(screen.queryByText('A new version is ready.')).not.toBeInTheDocument()
  })

  it('announces itself to assistive tech without stealing focus', async () => {
    const { rerender } = render(<UpdateBanner />)
    announceUpdate()
    rerender(<UpdateBanner />)

    const banner = await screen.findByRole('status')
    expect(banner).toHaveAttribute('aria-live', 'polite')
  })
})
