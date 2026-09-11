import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { ShareListSheet } from '../ShareListSheet'
import api from '@/lib/axios'

/**
 * Minting an invite supersedes: the server keeps one live code per list and deletes the
 * one it replaces. This sheet called the endpoint on every open, so re-opening it to
 * re-read a code already sent to someone silently revoked the code they were holding —
 * and all they saw was "Invalid or expired invite code".
 */

vi.mock('@/lib/axios', () => ({
  default: { post: vi.fn() },
}))

// jsdom implements neither of these on <dialog>.
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  })
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open')
  })
  vi.clearAllMocks()
})

describe('ShareListSheet', () => {
  it('mints once and shows the same code when reopened', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { code: 'CDFH2345' } } as never)

    const { rerender } = render(<ShareListSheet isOpen onClose={vi.fn()} activeListId="list-1" />)
    await waitFor(() => expect(screen.getByText('CDFH2345')).toBeInTheDocument())
    expect(api.post).toHaveBeenCalledTimes(1)

    rerender(<ShareListSheet isOpen={false} onClose={vi.fn()} activeListId="list-1" />)
    rerender(<ShareListSheet isOpen onClose={vi.fn()} activeListId="list-1" />)

    await waitFor(() => expect(screen.getByText('CDFH2345')).toBeInTheDocument())
    expect(api.post).toHaveBeenCalledTimes(1)
  })

  it('mints a new code only when asked to', async () => {
    vi.mocked(api.post)
      .mockResolvedValueOnce({ data: { code: 'CDFH2345' } } as never)
      .mockResolvedValueOnce({ data: { code: 'JKMN6789' } } as never)

    render(<ShareListSheet isOpen onClose={vi.fn()} activeListId="list-1" />)
    await waitFor(() => expect(screen.getByText('CDFH2345')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Get a new code/ }))

    await waitFor(() => expect(screen.getByText('JKMN6789')).toBeInTheDocument())
    expect(api.post).toHaveBeenCalledTimes(2)
  })

  it('mints for a different list rather than showing the previous list_s code', async () => {
    vi.mocked(api.post)
      .mockResolvedValueOnce({ data: { code: 'CDFH2345' } } as never)
      .mockResolvedValueOnce({ data: { code: 'JKMN6789' } } as never)

    const { rerender } = render(<ShareListSheet isOpen onClose={vi.fn()} activeListId="list-1" />)
    await waitFor(() => expect(screen.getByText('CDFH2345')).toBeInTheDocument())

    rerender(<ShareListSheet isOpen={false} onClose={vi.fn()} activeListId="list-2" />)
    rerender(<ShareListSheet isOpen onClose={vi.fn()} activeListId="list-2" />)

    await waitFor(() => expect(screen.getByText('JKMN6789')).toBeInTheDocument())
    expect(api.post).toHaveBeenCalledTimes(2)
  })

  it('shows what the server said rather than a generic string', async () => {
    vi.mocked(api.post).mockRejectedValue({
      response: { data: { error: 'Too many outstanding invites; wait for one to expire or be used' } },
    } as never)

    render(<ShareListSheet isOpen onClose={vi.fn()} activeListId="list-1" />)

    await waitFor(() =>
      expect(
        screen.getByText('Too many outstanding invites; wait for one to expire or be used')
      ).toBeInTheDocument()
    )
  })
})
