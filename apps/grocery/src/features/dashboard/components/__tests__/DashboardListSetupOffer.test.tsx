import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DashboardLayout, LIST_SETUP_SETTLE_MS } from '../DashboardLayout'
import { useGrocery } from '@/features/grocery/context/GroceryContext'
import { markListSetupOffered, hasOfferedListSetup } from '@/features/grocery/utils/listSetup'

/**
 * When the shell offers to set a list up. The trap is a list opened from local storage
 * before the launch sync has brought its stores down: offering then asks a question
 * the next second answers, and the offer is spent on a list that never needed it.
 */

vi.mock('@/features/grocery/context/GroceryContext', async importOriginal => {
  const actual = await importOriginal<typeof import('@/features/grocery/context/GroceryContext')>()
  return { ...actual, useGrocery: vi.fn() }
})

vi.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: () => ({ user: null, isLoading: false, logout: vi.fn() }),
}))

const list = {
  id: 'list-1', name: 'Home', createdAt: 0, sync_state: 'SYNCED', version: 1, is_deleted: false,
}

const contextWith = (over: Record<string, unknown>) => ({
  activeListId: 'list-1',
  setActiveListId: vi.fn(),
  activeList: list,
  isAwaitingJoinedList: false,
  items: [],
  setItems: vi.fn(),
  lists: [list],
  setLists: vi.fn(),
  listMembers: [],
  setListMembers: vi.fn(),
  stores: [],
  setStores: vi.fn(),
  categories: [],
  setCategories: vi.fn(),
  itemStoreInfos: [],
  setItemStoreInfos: vi.fn(),
  syncStatus: 'synced' as const,
  isSyncing: false,
  isOnline: true,
  pendingCount: 0,
  lastSyncedAt: '',
  handleManualSync: vi.fn(),
  bootstrapState: 'ready' as const,
  retryBootstrap: vi.fn(),
  ...over,
})

const renderShell = () => render(
  <MemoryRouter>
    <DashboardLayout />
  </MemoryRouter>
)

const sheetIsOpen = () =>
  screen.getByText('Set up Home').closest('dialog')?.hasAttribute('open') ?? false

describe('offering to set up an empty list', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('offers once the list has sat empty with no sync running', () => {
    vi.mocked(useGrocery).mockReturnValue(contextWith({}) as any)
    renderShell()

    expect(sheetIsOpen()).toBe(false)
    act(() => vi.advanceTimersByTime(LIST_SETUP_SETTLE_MS))
    expect(sheetIsOpen()).toBe(true)
    expect(hasOfferedListSetup('list-1')).toBe(true)
  })

  it('waits while a sync is running', () => {
    vi.mocked(useGrocery).mockReturnValue(contextWith({ isSyncing: true }) as any)
    renderShell()

    act(() => vi.advanceTimersByTime(LIST_SETUP_SETTLE_MS * 4))
    expect(sheetIsOpen()).toBe(false)
    expect(hasOfferedListSetup('list-1')).toBe(false)
  })

  it('does not offer twice for the same list', () => {
    markListSetupOffered('list-1')
    vi.mocked(useGrocery).mockReturnValue(contextWith({}) as any)
    renderShell()

    act(() => vi.advanceTimersByTime(LIST_SETUP_SETTLE_MS * 2))
    expect(sheetIsOpen()).toBe(false)
  })

  it('does not offer for a list that has both stores and categories', () => {
    vi.mocked(useGrocery).mockReturnValue(contextWith({
      stores: [{ id: 's', name: 'Aldi', position: 1, isDefaultSupported: false, listId: 'list-1', sync_state: 'SYNCED', version: 1, is_deleted: false }],
      categories: [{ id: 'c', name: 'Dairy', position: 1, listId: 'list-1', sync_state: 'SYNCED', version: 1, is_deleted: false }],
    }) as any)
    renderShell()

    act(() => vi.advanceTimersByTime(LIST_SETUP_SETTLE_MS * 2))
    expect(sheetIsOpen()).toBe(false)
    expect(hasOfferedListSetup('list-1')).toBe(false)
  })
})
