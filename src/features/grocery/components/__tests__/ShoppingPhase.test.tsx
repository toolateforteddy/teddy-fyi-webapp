import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ShoppingPhase } from '../ShoppingPhase'
import { useGrocery } from '@/features/grocery/context/GroceryContext'
import type { Store, Category, GroceryItem, GroceryItemStoreInfo } from '@/types/grocery'

// Mock useGrocery
vi.mock('@/features/grocery/context/GroceryContext', () => ({
  useGrocery: vi.fn(),
}))

describe('ShoppingPhase Component', () => {
  const mockSetItems = vi.fn()
  
  const mockStores: Store[] = [
    { id: 'store-1', name: 'Trader Joes', position: 1, isDefaultSupported: true, listId: 'list-1', sync_state: 'SYNCED', version: 1, is_deleted: false },
    { id: 'store-2', name: 'Costco', position: 2, isDefaultSupported: false, listId: 'list-1', sync_state: 'SYNCED', version: 1, is_deleted: false },
  ]

  const mockCategories: Category[] = [
    { id: '101', name: 'Produce', position: 1, listId: 'list-1', sync_state: 'SYNCED', version: 1, is_deleted: false },
    { id: '102', name: 'Dairy', position: 2, listId: 'list-1', sync_state: 'SYNCED', version: 1, is_deleted: false },
  ]

  const mockItems: GroceryItem[] = [
    { id: 'item-1', name: 'Apples', quantity: '3', isBought: false, createdAt: 1, position: 1, categoryId: '101', timesBought: 0, isActive: true, listId: 'list-1', sync_state: 'SYNCED', version: 1, is_deleted: false },
    { id: 'item-2', name: 'Milk', quantity: '1', isBought: false, createdAt: 2, position: 2, categoryId: '102', timesBought: 1, isActive: true, listId: 'list-1', sync_state: 'SYNCED', version: 1, is_deleted: false },
    { id: 'item-3', name: 'Bananas', quantity: '6', isBought: true, createdAt: 3, position: 3, categoryId: '101', timesBought: 2, isActive: true, listId: 'list-1', sync_state: 'SYNCED', version: 1, is_deleted: false },
  ]

  const mockItemStoreInfos: GroceryItemStoreInfo[] = [
    // Apples (item-1) available at Trader Joes (store-1)
    { groceryItemId: 'item-1', storeId: 'store-1', isAvailable: true, listId: 'list-1', sync_state: 'SYNCED', version: 1, is_deleted: false },
    // Milk (item-2) available at Costco (store-2)
    { groceryItemId: 'item-2', storeId: 'store-2', isAvailable: true, listId: 'list-1', sync_state: 'SYNCED', version: 1, is_deleted: false },
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
      itemStoreInfos: mockItemStoreInfos,
      setItemStoreInfos: vi.fn(),
      syncStatus: 'synced',
      isSyncing: false,
      lastSyncedAt: '',
      handleManualSync: vi.fn(),
    })
  })

  it('should render high velocity mode instructions when no store is isolated', () => {
    render(<ShoppingPhase />)

    expect(screen.getByText('High-Velocity Mode')).toBeInTheDocument()
    expect(screen.getByText(/Select which store you are physically at/i)).toBeInTheDocument()
    expect(screen.queryByText('Trip Progress')).not.toBeInTheDocument()
  })

  it('should render items when a store chip is selected and isolate to that store', () => {
    render(<ShoppingPhase />)

    // Click Trader Joes chip
    const traderJoesBtn = screen.getByRole('button', { name: /Trader Joes/ })
    fireEvent.click(traderJoesBtn)

    // Active store list should be visible now, with apples (Trader Joes) and bananas (mockItemStoreInfos has no mapping for bananas, so it displays everywhere)
    expect(screen.getByText('Trip Progress')).toBeInTheDocument()
    expect(screen.getByText('Apples')).toBeInTheDocument()
    expect(screen.getByText('Bananas')).toBeInTheDocument()
    
    // Milk (Costco) should not be visible when Trader Joes is isolated
    expect(screen.queryByText('Milk')).not.toBeInTheDocument()
  })

  it('should toggle item bought state on click', () => {
    render(<ShoppingPhase />)

    // Click Trader Joes
    const traderJoesBtn = screen.getByRole('button', { name: /Trader Joes/ })
    fireEvent.click(traderJoesBtn)

    // Click apples
    const applesBtn = screen.getByRole('button', { name: /Apples/ })
    fireEvent.click(applesBtn)

    expect(mockSetItems).toHaveBeenCalled()
    // Call updates item to isBought: true
    const updateFn = mockSetItems.mock.calls[0][0]
    const updated = updateFn(mockItems)
    const applesUpdated = updated.find((i: any) => i.id === 'item-1')
    expect(applesUpdated.isBought).toBe(true)
    expect(applesUpdated.sync_state).toBe('PENDING_UPDATE')
  })

  it('should open confirmation dialog and complete trip when confirm is clicked', () => {
    render(<ShoppingPhase />)

    // Select Trader Joes
    const traderJoesBtn = screen.getByRole('button', { name: /Trader Joes/ })
    fireEvent.click(traderJoesBtn)

    // In Cart bananas exists, so Complete Shopping Trip button is visible
    const completeTripBtn = screen.getByRole('button', { name: /Complete Shopping Trip/ })
    fireEvent.click(completeTripBtn)

    // Dialog should open
    const dialog = screen.getByRole('dialog', { hidden: true })
    expect(dialog).toHaveAttribute('open')

    // Confirm archiving trip
    const archiveBtn = screen.getByRole('button', { name: /Yes, Archive Trip/ })
    fireEvent.click(archiveBtn)

    expect(mockSetItems).toHaveBeenCalled()
    const updateFn = mockSetItems.mock.calls[0][0]
    const updated = updateFn(mockItems)
    
    // Bananas were bought, so they should be archived (isActive: false) and timesBought should be incremented (2 -> 3)
    const bananasUpdated = updated.find((i: any) => i.id === 'item-3')
    expect(bananasUpdated.isActive).toBe(false)
    expect(bananasUpdated.timesBought).toBe(3)
    expect(bananasUpdated.sync_state).toBe('PENDING_UPDATE')

    // Apples were not bought, so they remain unchanged
    const applesUpdated = updated.find((i: any) => i.id === 'item-1')
    expect(applesUpdated.isActive).toBe(true)
    expect(applesUpdated.isBought).toBe(false)
  })
})
