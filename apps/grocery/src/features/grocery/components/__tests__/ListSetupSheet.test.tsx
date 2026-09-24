import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ListSetupSheet } from '../ListSetupSheet'
import { useGrocery } from '@/features/grocery/context/GroceryContext'
import { STARTER_CATEGORIES } from '../../utils/listSetup'
import type { Category, Store } from '@/types/grocery'

vi.mock('@/features/grocery/context/GroceryContext', () => ({ useGrocery: vi.fn() }))

const setStores = vi.fn()
const setCategories = vi.fn()

const withRows = (stores: Store[] = [], categories: Category[] = []) => {
  vi.mocked(useGrocery).mockReturnValue({
    stores, setStores, categories, setCategories,
    handleManualSync: vi.fn().mockResolvedValue(null),
  } as any)
}

/** What the updater handed to a setter produces from an empty table. */
const added = <T,>(setter: ReturnType<typeof vi.fn>): T[] => setter.mock.calls[0][0]([])

const renderSheet = (onClose = vi.fn()) => {
  render(<ListSetupSheet isOpen onClose={onClose} listId="list-1" listName="Home" />)
  return onClose
}

describe('ListSetupSheet', () => {
  beforeEach(() => vi.clearAllMocks())

  it('asks both questions of a list with nothing on it', () => {
    withRows()
    renderSheet()

    expect(screen.getByText('Set up Home')).toBeInTheDocument()
    expect(screen.getByText('Where do you usually shop?')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /recommended categories/ })).toBeChecked()
  })

  it('adds the typed stores and the starter categories in one go', () => {
    withRows()
    const onClose = renderSheet()

    fireEvent.change(screen.getByLabelText('Store name'), { target: { value: 'Aldi' } })
    fireEvent.click(screen.getByRole('button', { name: /Add/ }))
    // Left in the box rather than added: still counts.
    fireEvent.change(screen.getByLabelText('Store name'), { target: { value: 'Costco' } })
    fireEvent.click(screen.getByRole('button', { name: 'Set up list' }))

    expect(added<Store>(setStores).map(s => s.name)).toEqual(['Aldi', 'Costco'])
    expect(added<Category>(setCategories).map(c => c.name)).toEqual(STARTER_CATEGORIES.map(c => c.name))
    expect(onClose).toHaveBeenCalled()
  })

  it('leaves the categories alone when the box is unticked', () => {
    withRows()
    renderSheet()

    fireEvent.click(screen.getByRole('checkbox', { name: /recommended categories/ }))
    fireEvent.change(screen.getByLabelText('Store name'), { target: { value: 'Aldi' } })
    fireEvent.click(screen.getByRole('button', { name: 'Set up list' }))

    expect(setStores).toHaveBeenCalled()
    expect(setCategories).not.toHaveBeenCalled()
  })

  it('asks only about what is missing', () => {
    withRows([{
      id: 's1', name: 'Aldi', position: 1, isDefaultSupported: false, listId: 'list-1',
      sync_state: 'SYNCED', version: 1, is_deleted: false,
    }])
    renderSheet()

    expect(screen.queryByText('Where do you usually shop?')).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /recommended categories/ })).toBeInTheDocument()
  })

  it('writes nothing on Not now', () => {
    withRows()
    const onClose = renderSheet()

    fireEvent.change(screen.getByLabelText('Store name'), { target: { value: 'Aldi' } })
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))

    expect(setStores).not.toHaveBeenCalled()
    expect(setCategories).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })
})
