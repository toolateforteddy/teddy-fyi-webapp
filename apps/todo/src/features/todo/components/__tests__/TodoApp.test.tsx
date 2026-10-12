import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TodoProvider } from '../../TodoContext'
import { TodoApp } from '../TodoApp'
import { STORAGE_KEYS } from '@/config/storageKeys'

const post = vi.fn()
const get = vi.fn()

vi.mock('@/lib/axios', () => ({
  default: {
    post: (...args: unknown[]) => post(...args),
    get: (...args: unknown[]) => get(...args),
  },
}))

vi.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'sub', surrogateId: 'surrogate', email: 'someone@example.com' },
    isAuthenticated: true,
    isLoading: false,
    logout: vi.fn(),
  }),
}))

function renderApp() {
  return render(
    <TodoProvider>
      <TodoApp />
    </TodoProvider>,
  )
}

describe('the todo screen', () => {
  beforeEach(() => {
    localStorage.clear()
    post.mockReset()
    get.mockReset()
    // Nothing changed upstream, so a sync only ever pushes.
    get.mockResolvedValue({ data: { has_changes: false } })
    post.mockResolvedValue({
      data: { success_ids: [], upload_status: [], remote_todo_list_changes: [], remote_todo_changes: [], server_timestamp: '2026-10-12T00:00:00Z' },
    })
  })

  it('adds a task to the backlog, title-cased, and sends it to the server', async () => {
    renderApp()
    expect(screen.getByRole('heading', { name: 'Backlog' })).toBeInTheDocument()

    await userEvent.type(screen.getByRole('textbox', { name: 'Add a task' }), 'pay  rent{Enter}')

    expect(await screen.findByText('Pay Rent')).toBeInTheDocument()
    type Body = { scope: string; todo_changes: Array<{ type: string; data: { title: string } }> }
    // The first sync, on open, has nothing to send; the push a moment after the add does.
    const pushed = () => post.mock.calls.find(([url, body]) => url === '/api/sync' && (body as Body).todo_changes.length > 0)
    await waitFor(() => expect(pushed()).toBeTruthy(), { timeout: 3000 })
    const body = pushed()![1] as Body
    expect(body.scope).toBe('TODO')
    expect(body.todo_changes[0].type).toBe('INSERT')
    expect(body.todo_changes[0].data.title).toBe('Pay Rent')
  })

  it('opens on a tab a launcher shortcut names', async () => {
    window.history.replaceState(null, '', '/?mode=SCHEDULED')
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Future' })).toBeInTheDocument()
    expect(window.location.search).toBe('')
  })

  it('keeps a ticked task on screen for a beat, struck through', async () => {
    localStorage.setItem(
      STORAGE_KEYS.ITEMS,
      JSON.stringify([
        {
          id: 'a', title: 'Water Plants', isCompleted: false, createdAt: 1, position: 0, scheduledDate: null,
          recurrenceRule: null, scheduledAt: 1, userId: 'surrogate', parentId: null, isDaily: false, dueDate: null,
          description: null, listId: null, priority: 0, icon: 'Yard', lastScheduledDate: null, syncState: 'SYNCED',
          version: 1, isDeleted: false,
        },
      ]),
    )
    renderApp()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Tick Water Plants' }))
    expect(screen.getByText('Water Plants')).toHaveClass('line-through')
    expect(screen.getByRole('checkbox', { name: 'Untick Water Plants' })).toHaveAttribute('aria-checked', 'true')
  })
})
