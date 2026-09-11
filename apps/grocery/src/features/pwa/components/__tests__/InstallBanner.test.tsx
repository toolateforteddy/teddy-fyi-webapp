import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InstallBanner } from '../InstallBanner'
import type { InstallKind } from '../../install'

const promptInstall = vi.fn().mockResolvedValue('accepted')
let announceInstall: ((kind: InstallKind) => void) | null = null
let announceUpdate: ((ready: boolean) => void) | null = null
let initialKind: InstallKind = 'none'
let initialUpdate = false
let handheld = true

vi.mock('../../install', async importOriginal => {
  const actual = await importOriginal<typeof import('../../install')>()
  return {
    ...actual,
    isHandheld: () => handheld,
    subscribeToInstall: (listener: (kind: InstallKind) => void) => {
      announceInstall = listener
      listener(initialKind)
      return () => {
        announceInstall = null
      }
    },
    promptInstall: () => promptInstall(),
  }
})

vi.mock('@/pwa', () => ({
  subscribeToUpdates: (listener: (ready: boolean) => void) => {
    announceUpdate = listener
    listener(initialUpdate)
    return () => {
      announceUpdate = null
    }
  },
  applyUpdate: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  announceInstall = null
  announceUpdate = null
  initialKind = 'none'
  initialUpdate = false
  handheld = true
})

describe('InstallBanner', () => {
  it('renders nothing when the browser has not offered an install', () => {
    const { container } = render(<InstallBanner />)

    expect(container).toBeEmptyDOMElement()
  })

  it('offers an install button once the browser says the app qualifies', () => {
    initialKind = 'prompt'

    render(<InstallBanner />)

    expect(screen.getByText('Add Grocery to your home screen.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Install' })).toBeInTheDocument()
  })

  it('shows the prompt when install is pressed', async () => {
    initialKind = 'prompt'
    const user = userEvent.setup()
    render(<InstallBanner />)

    await user.click(screen.getByRole('button', { name: 'Install' }))

    expect(promptInstall).toHaveBeenCalledTimes(1)
  })

  // iOS has no install API, so the only thing to offer is the instruction.
  it('offers instructions instead of a button on iOS', async () => {
    initialKind = 'instructions'
    const user = userEvent.setup()
    render(<InstallBanner />)

    expect(screen.queryByRole('button', { name: 'Install' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'How' }))

    expect(screen.getByText('Add to Home Screen')).toBeInTheDocument()
  })

  // A banner that comes back next launch is one the user dismisses forever.
  it('stays dismissed across a remount', async () => {
    initialKind = 'prompt'
    const user = userEvent.setup()
    const { unmount } = render(<InstallBanner />)

    await user.click(screen.getByRole('button', { name: 'Do not offer this again' }))
    expect(screen.queryByText('Add Grocery to your home screen.')).not.toBeInTheDocument()

    unmount()
    const { container } = render(<InstallBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  // Both notices use the same slot. Two overlapping cards is the bug; an update is
  // the more urgent of the two.
  it('gets out of the way of a pending update', () => {
    initialKind = 'prompt'
    initialUpdate = true

    const { container } = render(<InstallBanner />)

    expect(container).toBeEmptyDOMElement()
  })

  it('comes back once the update has been dealt with', () => {
    initialKind = 'prompt'
    initialUpdate = true
    const { rerender } = render(<InstallBanner />)

    announceUpdate?.(false)
    rerender(<InstallBanner />)

    expect(screen.getByText('Add Grocery to your home screen.')).toBeInTheDocument()
  })

  it('disappears once the app has been installed', () => {
    initialKind = 'prompt'
    const { rerender } = render(<InstallBanner />)

    announceInstall?.('none')
    rerender(<InstallBanner />)

    expect(screen.queryByText('Add Grocery to your home screen.')).not.toBeInTheDocument()
  })

  // The offer is a home-screen icon that opens with no signal, which is not
  // something a laptop wants. Chrome fires beforeinstallprompt there anyway.
  it('does not ask on a device with a mouse', () => {
    initialKind = 'prompt'
    handheld = false

    const { container } = render(<InstallBanner />)

    expect(container).toBeEmptyDOMElement()
  })
})
