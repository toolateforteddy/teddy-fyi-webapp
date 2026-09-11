import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StoreConfigPanel } from '../StoreConfigPanel'
import { useGrocery } from '@/features/grocery/context/GroceryContext'
import type { Store } from '@/types/grocery'

// Mock useGrocery
vi.mock('@/features/grocery/context/GroceryContext', () => ({
  useGrocery: vi.fn(),
}))

describe('StoreConfigPanel Component', () => {
  const mockSetStores = vi.fn()
  const mockHandleManualSync = vi.fn(() => Promise.resolve())
  const mockShowToast = vi.fn()
  const mockOnBack = vi.fn()

  const mockStores: Store[] = [
    { id: 'store-1', name: 'Trader Joes', position: 1, isDefaultSupported: true, listId: 'list-1', sync_state: 'SYNCED', version: 1, is_deleted: false },
    { id: 'store-2', name: 'Costco', position: 2, isDefaultSupported: false, listId: 'list-1', sync_state: 'SYNCED', version: 1, is_deleted: false },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    vi.mocked(useGrocery).mockReturnValue({
      activeListId: 'list-1',
      setActiveListId: vi.fn(),
      items: [],
      setItems: vi.fn(),
      lists: [],
      setLists: vi.fn(),
      listMembers: [],
      setListMembers: vi.fn(),
      stores: mockStores,
      setStores: mockSetStores,
      categories: [],
      setCategories: vi.fn(),
      itemStoreInfos: [],
      setItemStoreInfos: vi.fn(),
      syncStatus: 'synced',
      isSyncing: false,
      isOnline: true,
      pendingCount: 0,
      lastSyncedAt: '',
      handleManualSync: mockHandleManualSync,
    })
  })

  it('should render the list of stores', () => {
    render(<StoreConfigPanel onBack={mockOnBack} showToast={mockShowToast} />)
    expect(screen.getByText('Trader Joes')).toBeInTheDocument()
    expect(screen.getByText('Costco')).toBeInTheDocument()
  })

  it('should enter edit mode when clicking the edit button', () => {
    render(<StoreConfigPanel onBack={mockOnBack} showToast={mockShowToast} />)
    
    const editButtons = screen.getAllByRole('button', { name: 'Edit store' })
    fireEvent.click(editButtons[0]) // Click first store's edit button
    
    const input = screen.getByDisplayValue('Trader Joes')
    expect(input).toBeInTheDocument()
  })

  it('should save the change and trigger sync when pressing Enter key', () => {
    render(<StoreConfigPanel onBack={mockOnBack} showToast={mockShowToast} />)
    
    const editButtons = screen.getAllByRole('button', { name: 'Edit store' })
    fireEvent.click(editButtons[0])
    
    const input = screen.getByDisplayValue('Trader Joes')
    fireEvent.change(input, { target: { value: 'Trader Joes New' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', charCode: 13 })

    // Verify setStores was called to update the store name
    expect(mockSetStores).toHaveBeenCalled()
    const updateFn = mockSetStores.mock.calls[0][0]
    const resultStores = updateFn(mockStores)
    expect(resultStores[0].name).toBe('Trader Joes New')
    expect(resultStores[0].sync_state).toBe('PENDING_UPDATE')

    // Toast should show up
    expect(mockShowToast).toHaveBeenCalledWith('Store name updated.')

    // Verify handleManualSync gets triggered via setTimeout
    vi.runAllTimers()
    expect(mockHandleManualSync).toHaveBeenCalled()
  })

  it('should cancel edit when pressing Escape key', () => {
    render(<StoreConfigPanel onBack={mockOnBack} showToast={mockShowToast} />)
    
    const editButtons = screen.getAllByRole('button', { name: 'Edit store' })
    fireEvent.click(editButtons[0])
    
    const input = screen.getByDisplayValue('Trader Joes')
    fireEvent.change(input, { target: { value: 'Trader Joes New' } })
    fireEvent.keyDown(input, { key: 'Escape', code: 'Escape', charCode: 27 })

    // Input should be removed and original name displayed
    expect(screen.queryByDisplayValue('Trader Joes New')).not.toBeInTheDocument()
    expect(screen.getByText('Trader Joes')).toBeInTheDocument()
    expect(mockSetStores).not.toHaveBeenCalled()
  })
})
