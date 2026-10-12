import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
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

  it('files a new task under the space picked mid-typing, with the keyboard kept up', async () => {
    localStorage.setItem(
      STORAGE_KEYS.LISTS,
      JSON.stringify([
        { id: 'work', name: 'Work', colorHex: '#FF0000', userId: 'surrogate', createdAt: 1, syncState: 'SYNCED', version: 1, isDeleted: false },
      ]),
    )
    renderApp()
    const field = screen.getByRole('textbox', { name: 'Add a task' })
    await userEvent.click(field)
    // The tab bar steps aside while the keyboard is up, and the bar says where the task goes.
    expect(screen.queryByRole('button', { name: 'Today' })).not.toBeInTheDocument()
    expect(screen.getByText('No space')).toBeInTheDocument()

    await userEvent.type(field, 'ship it')
    await userEvent.click(screen.getByRole('button', { name: 'Work' }))
    expect(field).toHaveFocus()
    expect(screen.getByText('In Work')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Add task' }))
    expect(field).toHaveFocus()
    expect(await screen.findByText('Ship It')).toBeInTheDocument()
    type Stored = Array<{ title: string; listId: string | null }>
    const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEYS.ITEMS) ?? '[]') as Stored
    await waitFor(() => expect(stored().find((i) => i.title === 'Ship It')?.listId).toBe('work'))
  })

  it('keeps the keyboard up while a new space gets its colour', async () => {
    renderApp()
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    await userEvent.click(screen.getByRole('button', { name: 'Add space' }))
    const name = screen.getByRole('textbox', { name: 'Space name' })
    await userEvent.type(name, 'Work')
    const swatch = screen.getAllByRole('radio')[1]
    await userEvent.click(swatch)
    expect(swatch).toHaveAttribute('aria-checked', 'true')
    expect(name).toHaveFocus()
  })

  it('adds subtasks one after another until Finish', async () => {
    renderApp()
    await userEvent.type(screen.getByRole('textbox', { name: 'Add a task' }), 'pack{Enter}')
    await userEvent.click(await screen.findByRole('button', { name: 'More for Pack' }))
    await userEvent.click(screen.getByRole('button', { name: 'Add subtask' }))

    const field = screen.getByRole('textbox', { name: 'New subtask' })
    await userEvent.type(field, 'socks{Enter}')
    await userEvent.type(field, 'shirts')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(field).toHaveFocus()
    const listed = within(screen.getByRole('list', { name: 'Subtasks' }))
    expect(listed.getByText('Socks')).toBeInTheDocument()
    expect(listed.getByText('Shirts')).toBeInTheDocument()

    await userEvent.type(field, 'shoes')
    await userEvent.click(screen.getByRole('button', { name: 'Finish' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    type Stored = Array<{ title: string; parentId: string | null }>
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.ITEMS) ?? '[]') as Stored
    const parentId = stored.find((i) => i.title === 'Pack')!.parentId
    expect(parentId).toBeNull()
    expect(stored.filter((i) => i.parentId !== null).map((i) => i.title)).toEqual(['Socks', 'Shirts', 'Shoes'])
  })

  it("collapses a parent's subtasks, and remembers it open", async () => {
    const row = (id: string, title: string, parentId: string | null, isCompleted = false) => ({
      id, title, isCompleted, createdAt: 1, position: 0, scheduledDate: null, recurrenceRule: null, scheduledAt: 1,
      userId: 'surrogate', parentId, isDaily: false, dueDate: null, description: null, listId: null, priority: 0,
      icon: null, lastScheduledDate: null, syncState: 'SYNCED', version: 1, isDeleted: false,
    })
    localStorage.setItem(
      STORAGE_KEYS.ITEMS,
      JSON.stringify([row('p', 'Pack', null), row('a', 'Socks', 'p', true), row('b', 'Shirts', 'p')]),
    )
    const { unmount } = renderApp()
    // Collapsed by default, with a count where the subtasks would be.
    // The count covers the finished subtask too, which the open view does not list.
    expect(screen.queryByText('Shirts')).not.toBeInTheDocument()
    expect(screen.getByText('(1/2)')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Expand Pack' }))
    expect(screen.getByText('Shirts')).toBeInTheDocument()
    expect(screen.queryByText('(1/2)')).not.toBeInTheDocument()

    unmount()
    renderApp()
    expect(screen.getByText('Shirts')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Collapse Pack' }))
    expect(screen.queryByText('Shirts')).not.toBeInTheDocument()
  })
})
