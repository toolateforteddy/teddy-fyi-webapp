import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NeedPhase } from '../NeedPhase'
import { useGrocery } from '@/features/grocery/context/GroceryContext'
import type { Store, Category, GroceryItem } from '@/types/grocery'

// Mock useGrocery
vi.mock('@/features/grocery/context/GroceryContext', () => ({
  useGrocery: vi.fn(),
}))

describe('NeedPhase Component', () => {
  const mockSetItems = vi.fn()
  const mockSetItemStoreInfos = vi.fn()

  const mockStores: Store[] = [
    { id: 1, name: 'Trader Joes', position: 1, isDefaultSupported: true, listId: 'list-1', sync_state: 'SYNCED', version: 1, is_deleted: false },
    { id: 2, name: 'Costco', position: 2, isDefaultSupported: false, listId: 'list-1', sync_state: 'SYNCED', version: 1, is_deleted: false },
  ]

  const mockCategories: Category[] = [
    { id: '101', name: 'Produce', position: 1, listId: 'list-1', sync_state: 'SYNCED', version: 1, is_deleted: false },
    { id: '102', name: 'Dairy', position: 2, listId: 'list-1', sync_state: 'SYNCED', version: 1, is_deleted: false },
  ]

  const mockItems: GroceryItem[] = [
    { id: 'item-1', name: 'Apples', quantity: '3', isBought: false, createdAt: 1, position: 1, categoryId: '101', timesBought: 0, isActive: true, listId: 'list-1', sync_state: 'SYNCED', version: 1, is_deleted: false },
    { id: 'item-2', name: 'Milk', quantity: '1', isBought: false, createdAt: 2, position: 2, categoryId: '102', timesBought: 1, isActive: true, listId: 'list-1', sync_state: 'SYNCED', version: 1, is_deleted: false },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()

    vi.mocked(useGrocery).mockReturnValue({
      activeListId: 'list-1',
      setActiveListId: vi.fn(),
      items: mockItems,
      setItems: mockSetItems,
      lists: [{ id: 'list-1', name: 'My List', is_deleted: false, version: 1, sync_state: 'SYNCED', createdAt: 0 }],
      setLists: vi.fn(),
      listMembers: [],
      setListMembers: vi.fn(),
      stores: mockStores,
      setStores: vi.fn(),
      categories: mockCategories,
      setCategories: vi.fn(),
      itemStoreInfos: [],
      setItemStoreInfos: mockSetItemStoreInfos,
      syncStatus: 'synced',
      isSyncing: false,
      lastSyncedAt: '',
      handleManualSync: vi.fn(),
    })
  })

  it('should render empty state when activeItems list is empty', () => {
    vi.mocked(useGrocery).mockReturnValueOnce({
      activeListId: 'list-1',
      setActiveListId: vi.fn(),
      items: [],
      setItems: mockSetItems,
      lists: [],
      setLists: vi.fn(),
      listMembers: [],
      setListMembers: vi.fn(),
      stores: [],
      setStores: vi.fn(),
      categories: [],
      setCategories: vi.fn(),
      itemStoreInfos: [],
      setItemStoreInfos: mockSetItemStoreInfos,
      syncStatus: 'synced',
      isSyncing: false,
      lastSyncedAt: '',
      handleManualSync: vi.fn(),
    })

    render(<NeedPhase />)

    expect(screen.getByText('Your list is empty')).toBeInTheDocument()
    expect(screen.getByText(/Tap the floating action button below/)).toBeInTheDocument()
  })

  it('should render items grouped by category', () => {
    render(<NeedPhase />)

    expect(screen.getByRole('heading', { name: 'Produce' })).toBeInTheDocument()
    expect(screen.getByText('Apples')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Dairy' })).toBeInTheDocument()
    expect(screen.getByText('Milk')).toBeInTheDocument()
  })

  it('should expand item tile when clicked, revealing edit controls', () => {
    render(<NeedPhase />)

    const applesTile = screen.getByText('Apples')
    fireEvent.click(applesTile)

    // Verify expanded controls are visible
    expect(screen.getByRole('button', { name: /Close edit/ })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Delete item/ })[0]).toBeInTheDocument()
    expect(screen.getByText('Qty: 3')).toBeInTheDocument()
    expect(screen.getByText('Trader Joes')).toBeInTheDocument()
    expect(screen.getByText('Costco')).toBeInTheDocument()
  })

  it('should update quantity when increment/decrement buttons are clicked', () => {
    render(<NeedPhase />)

    // Expand Apples
    fireEvent.click(screen.getByText('Apples'))

    // Find the Plus button using its aria-label
    const incrementBtn = screen.getByRole('button', { name: 'Increase quantity' })
    fireEvent.click(incrementBtn)

    expect(mockSetItems).toHaveBeenCalled()
    const updateFn = mockSetItems.mock.calls[0][0]
    const updated = updateFn(mockItems)
    const applesUpdated = updated.find((i: any) => i.id === 'item-1')
    expect(applesUpdated.quantity).toBe('4')
    expect(applesUpdated.sync_state).toBe('PENDING_UPDATE')
  })

  it('should toggle store availability when store chip is clicked', () => {
    render(<NeedPhase />)

    // Expand Apples
    fireEvent.click(screen.getByText('Apples'))

    // Click Trader Joes store chip inside Apples tile
    const tjBtn = screen.getByRole('button', { name: 'Trader Joes' })
    fireEvent.click(tjBtn)

    expect(mockSetItemStoreInfos).toHaveBeenCalled()
    const updateFn = mockSetItemStoreInfos.mock.calls[0][0]
    const updated = updateFn([])
    expect(updated[0]).toEqual(expect.objectContaining({
      groceryItemId: 'item-1',
      storeId: 1,
      isAvailable: true,
      listId: 'list-1',
      sync_state: 'PENDING_INSERT',
    }))
  })

  it('should call deleteItem when delete button is clicked', () => {
    render(<NeedPhase />)

    // Expand Apples
    fireEvent.click(screen.getByText('Apples'))

    // Click Trash button (use getAllByRole since other items also have collapsed delete buttons)
    const deleteBtn = screen.getAllByRole('button', { name: 'Delete item' })[0]
    fireEvent.click(deleteBtn)

    expect(mockSetItems).toHaveBeenCalled()
    const updateFn = mockSetItems.mock.calls[0][0]
    const updated = updateFn(mockItems)
    const applesUpdated = updated.find((i: any) => i.id === 'item-1')
    expect(applesUpdated.isActive).toBe(false)
    expect(applesUpdated.is_deleted).toBe(true)
    expect(applesUpdated.sync_state).toBe('PENDING_DELETE')
  })

  it('should open AddNeededItemSheet when FAB is clicked', () => {
    render(<NeedPhase />)

    const fabBtn = screen.getByRole('button', { name: 'Add grocery item' })
    fireEvent.click(fabBtn)

    expect(screen.getByPlaceholderText('What is needed? (e.g. Milk, Eggs)')).toBeInTheDocument()
  })
})
