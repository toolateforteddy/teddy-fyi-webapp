import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ListMenu } from '../ListMenu'
import { useGrocery } from '@/features/grocery/context/GroceryContext'
import type { GroceryList } from '@/types/grocery'

vi.mock('@/features/grocery/context/GroceryContext', () => ({ useGrocery: vi.fn() }))
vi.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'sub', surrogateId: 'owner-1', email: 'a@b.c' } }),
}))

const row = (id: string, name: string): GroceryList => ({
  id, name, createdAt: 1, sync_state: 'SYNCED', version: 1, is_deleted: false,
})

let lists: GroceryList[]
const setActiveListId = vi.fn()
const setLists = vi.fn((update: (prev: GroceryList[]) => GroceryList[]) => { lists = update(lists) })

function mount(initial: GroceryList[], activeId = initial[0].id) {
  lists = initial
  vi.mocked(useGrocery).mockReturnValue({
    lists,
    setLists,
    activeList: lists.find(l => l.id === activeId),
    setActiveListId,
  } as unknown as ReturnType<typeof useGrocery>)
  const props = { onShare: vi.fn(), onJoin: vi.fn() }
  render(<ListMenu {...props} />)
  fireEvent.click(screen.getByRole('button', { name: /Home/ }))
  return props
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

describe('ListMenu', () => {
  it('lists every list and switches to the one tapped', () => {
    mount([row('a', 'Home'), row('b', 'Cabin')])

    expect(screen.getByRole('menuitemradio', { name: 'Home' })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Cabin' }))

    expect(setActiveListId).toHaveBeenCalledWith('b')
  })

  it('makes a new list and switches to it', () => {
    mount([row('a', 'Home')])

    fireEvent.click(screen.getByRole('menuitem', { name: /New list/ }))
    fireEvent.change(screen.getByLabelText('New list name'), { target: { value: 'Costco' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    const created = lists.find(l => l.name === 'Costco')
    expect(created).toMatchObject({ ownerId: 'owner-1', sync_state: 'PENDING_INSERT' })
    expect(setActiveListId).toHaveBeenCalledWith(created!.id)
  })

  it('renames the list it is on', () => {
    mount([row('a', 'Home')])

    fireEvent.click(screen.getByRole('menuitem', { name: /Rename/ }))
    fireEvent.change(screen.getByLabelText('List name'), { target: { value: 'House' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(lists[0]).toMatchObject({ name: 'House', sync_state: 'PENDING_UPDATE' })
  })

  it('deletes after asking, and moves to another list', () => {
    mount([row('a', 'Home'), row('b', 'Cabin')])

    fireEvent.click(screen.getByRole('menuitem', { name: /Delete/ }))

    expect(window.confirm).toHaveBeenCalled()
    expect(lists.find(l => l.id === 'a')).toMatchObject({ is_deleted: true, sync_state: 'PENDING_DELETE' })
    expect(setActiveListId).toHaveBeenCalledWith('b')
  })

  it('does not offer to delete the last list', () => {
    mount([row('a', 'Home')])

    expect(screen.queryByRole('menuitem', { name: /Delete/ })).not.toBeInTheDocument()
  })

  it('hands Share and Join to the sheets', () => {
    const props = mount([row('a', 'Home')])

    fireEvent.click(screen.getByRole('menuitem', { name: /Share/ }))
    expect(props.onShare).toHaveBeenCalled()
  })
})
