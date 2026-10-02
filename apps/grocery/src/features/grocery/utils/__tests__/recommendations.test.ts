import { describe, it, expect } from 'vitest'
import { recommendationsFromHistory } from '../recommendations'
import { RECENT_PURCHASE_WINDOW_MS } from '../recentPurchase'
import type { GroceryItem } from '@/types/grocery'

const NOW = 10 * RECENT_PURCHASE_WINDOW_MS

function archived(id: string, name: string, timesBought: number, lastBoughtAt?: number, categoryId?: string): GroceryItem {
  return {
    id, name, quantity: '1', isBought: false, createdAt: 1, position: 1, timesBought, lastBoughtAt,
    categoryId, isActive: false, listId: 'list-1', sync_state: 'SYNCED', version: 1, is_deleted: false,
  }
}

describe('recommendationsFromHistory', () => {
  it('gives one entry per name, summing the counts of rows that share it', () => {
    const recs = recommendationsFromHistory(
      [archived('a', 'Milk', 2, undefined, 'x'), archived('b', 'milk', 5, undefined, 'dairy'), archived('c', 'Eggs', 3)],
      'list-1',
      NOW
    )

    expect(recs).toEqual([
      // Spelling and category from the row bought most often.
      { name: 'milk', categoryId: 'dairy', timesBought: 7 },
      { name: 'Eggs', categoryId: '1', timesBought: 3 },
    ])
  })

  it('holds a name back when any of its rows was bought recently, however old the others are', () => {
    const recs = recommendationsFromHistory(
      [archived('old', 'Milk', 9, NOW - 3 * RECENT_PURCHASE_WINDOW_MS), archived('new', 'Milk', 1, NOW - 1000)],
      'list-1',
      NOW
    )

    expect(recs).toEqual([])
  })

  it('leaves out rows that are deleted, never bought, or on another list', () => {
    const deleted = { ...archived('d', 'Salt', 3), is_deleted: true }
    const elsewhere = { ...archived('e', 'Flour', 3), listId: 'list-2' }

    const recs = recommendationsFromHistory([deleted, elsewhere, archived('n', 'Rice', 0)], 'list-1', NOW)

    expect(recs).toEqual([])
  })
})
