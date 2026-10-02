import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PlanningPhase } from '../PlanningPhase'
import { useGrocery } from '@/features/grocery/context/GroceryContext'
import type { GroceryItem } from '@/types/grocery'

vi.mock('@/features/grocery/context/GroceryContext', () => ({
  useGrocery: vi.fn(),
}))

const HOUR = 60 * 60 * 1000

function archived(id: string, name: string, lastBoughtAt?: number): GroceryItem {
  return {
    id, name, quantity: '1', isBought: false, createdAt: 1, position: 1, timesBought: 2,
    isActive: false, listId: 'list-1', sync_state: 'SYNCED', version: 1, is_deleted: false,
    lastBoughtAt,
  }
}

describe('PlanningPhase recommendations', () => {
  it('leaves out anything a trip bought in the last 36 hours', () => {
    const now = Date.now()
    vi.mocked(useGrocery).mockReturnValue({
      activeListId: 'list-1',
      items: [
        archived('a', 'Milk', now - HOUR),
        archived('b', 'Eggs', now - 35 * HOUR),
        archived('c', 'Flour', now - 37 * HOUR),
        archived('d', 'Salt'),
      ],
      setItems: vi.fn(),
      stores: [],
      setItemStoreInfos: vi.fn(),
    } as unknown as ReturnType<typeof useGrocery>)

    render(<PlanningPhase />)

    expect(screen.queryByText('Milk')).not.toBeInTheDocument()
    expect(screen.queryByText('Eggs')).not.toBeInTheDocument()
    expect(screen.getByText('Flour')).toBeInTheDocument()
    expect(screen.getByText('Salt')).toBeInTheDocument()
  })

  it('shows a name held by several rows once, and tapping it brings a row back instead of inserting', () => {
    const setItems = vi.fn()
    const setItemStoreInfos = vi.fn()
    const items = [archived('a', 'Salt'), archived('b', 'salt')]
    vi.mocked(useGrocery).mockReturnValue({
      activeListId: 'list-1',
      items,
      setItems,
      stores: [],
      setItemStoreInfos,
    } as unknown as ReturnType<typeof useGrocery>)

    render(<PlanningPhase />)

    const tiles = screen.getAllByRole('button', { name: /salt/i })
    expect(tiles).toHaveLength(1)

    fireEvent.click(tiles[0])

    const update = setItems.mock.calls[0][0] as (prev: GroceryItem[]) => GroceryItem[]
    const next = update(items)
    expect(next).toHaveLength(2)
    expect(next.filter(i => i.isActive)).toHaveLength(1)
    expect(next.find(i => i.isActive)?.sync_state).toBe('PENDING_UPDATE')
  })
})
