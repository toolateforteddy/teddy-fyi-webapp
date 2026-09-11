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
  const mockSetItemStoreInfos = vi.fn()
  
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

  // Re-mocks the grocery context, so a test can put an item in the cart that the
  // component itself could not have put there (setItems is a spy, not state).
  const mockGroceryContext = (overrides: Partial<ReturnType<typeof useGrocery>> = {}) => {
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
      setItemStoreInfos: mockSetItemStoreInfos,
      syncStatus: 'synced',
      isSyncing: false,
      isOnline: true,
      pendingCount: 0,
      lastSyncedAt: '',
      handleManualSync: vi.fn(),
      bootstrapState: 'ready' as const,
      retryBootstrap: vi.fn(),
      ...overrides,
    })
  }

  const selectTraderJoes = () => {
    fireEvent.click(screen.getByRole('button', { name: /Trader Joes/ }))
  }

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()

    mockGroceryContext()
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

  describe('buying something the store is not mapped for', () => {
    // Milk (item-2) is mapped to Costco, so Trader Joes hides it. This is the
    // Fage case: available here, just not where you normally buy it.
    const boughtOffMappingItems: GroceryItem[] = mockItems.map(item =>
      item.id === 'item-2' ? { ...item, isBought: true } : item
    )

    it('offers hidden items in a collapsed tray and buys one on click', () => {
      render(<ShoppingPhase />)
      selectTraderJoes()

      // Collapsed: the item is named only on the toggle's count, not on screen.
      expect(screen.queryByText('Milk')).not.toBeInTheDocument()

      const tray = screen.getByRole('button', { name: /Not usually here \(1\)/ })
      expect(tray).toHaveAttribute('aria-expanded', 'false')
      fireEvent.click(tray)

      expect(tray).toHaveAttribute('aria-expanded', 'true')
      expect(screen.getByText('Milk')).toBeInTheDocument()
      expect(screen.getByText('Usually Costco')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: /Milk/ }))

      const updated = mockSetItems.mock.calls[0][0](mockItems)
      expect(updated.find((i: any) => i.id === 'item-2').isBought).toBe(true)
    })

    it('keeps an off-mapping purchase visible in the cart once it is bought', () => {
      mockGroceryContext({ items: boughtOffMappingItems })
      render(<ShoppingPhase />)
      selectTraderJoes()

      expect(screen.getByText('In Cart (2)')).toBeInTheDocument()
      // Twice: the cart tile, and the confirmation dialog that is in the DOM
      // closed until the trip is completed.
      expect(screen.getAllByText('Milk')).toHaveLength(2)
      // It is in the cart, so it is no longer something the tray offers.
      expect(screen.queryByText(/Not usually here/)).not.toBeInTheDocument()
    })

    it('leaves the mapping alone when the confirmation box is not ticked', () => {
      mockGroceryContext({ items: boughtOffMappingItems })
      render(<ShoppingPhase />)
      selectTraderJoes()

      fireEvent.click(screen.getByRole('button', { name: /Complete Shopping Trip/ }))

      const optIn = screen.getByRole('checkbox', { name: /Milk/ })
      expect(optIn).not.toBeChecked()

      fireEvent.click(screen.getByRole('button', { name: /Yes, Archive Trip/ }))

      expect(mockSetItems).toHaveBeenCalled()
      expect(mockSetItemStoreInfos).not.toHaveBeenCalled()
    })

    it('adds the store to the mapping only for ticked items', () => {
      mockGroceryContext({ items: boughtOffMappingItems })
      render(<ShoppingPhase />)
      selectTraderJoes()

      fireEvent.click(screen.getByRole('button', { name: /Complete Shopping Trip/ }))
      fireEvent.click(screen.getByRole('checkbox', { name: /Milk/ }))
      fireEvent.click(screen.getByRole('button', { name: /Yes, Archive Trip/ }))

      expect(mockSetItemStoreInfos).toHaveBeenCalledTimes(1)
      const updated = mockSetItemStoreInfos.mock.calls[0][0](mockItemStoreInfos)

      const milkMappings = updated.filter((info: GroceryItemStoreInfo) => info.groceryItemId === 'item-2')
      expect(milkMappings).toHaveLength(2)

      const added = milkMappings.find((info: GroceryItemStoreInfo) => info.storeId === 'store-1')
      expect(added).toMatchObject({ isAvailable: true, listId: 'list-1', sync_state: 'PENDING_INSERT', is_deleted: false })

      // Bananas were bought too, but they are mapped nowhere, so nothing about
      // them is off-mapping and nothing was added for them.
      expect(updated.filter((info: GroceryItemStoreInfo) => info.groceryItemId === 'item-3')).toHaveLength(0)
    })

    it('does not ask about items that are mapped nowhere', () => {
      render(<ShoppingPhase />)
      selectTraderJoes()

      // Bananas are in the cart, mapped nowhere -- so they show at every store
      // and completing the trip has nothing to confirm.
      fireEvent.click(screen.getByRole('button', { name: /Complete Shopping Trip/ }))

      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
      expect(screen.getByText(/This will archive and clear all 1 checked items/)).toBeInTheDocument()
    })
  })
})
