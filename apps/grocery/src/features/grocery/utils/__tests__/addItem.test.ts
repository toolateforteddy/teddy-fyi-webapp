import { describe, it, expect, vi } from 'vitest'
import { addOrReuseItem, findReusableItem } from '../addItem'
import type { GroceryItem } from '@/types/grocery'

function row(overrides: Partial<GroceryItem>): GroceryItem {
  return {
    id: 'x', name: 'Milk', quantity: '1', isBought: false, createdAt: 1, position: 1,
    timesBought: 0, isActive: false, listId: 'list-1', sync_state: 'SYNCED', version: 3,
    is_deleted: false, ...overrides,
  }
}

const fresh = (): GroceryItem => row({ id: 'new', isActive: true, sync_state: 'PENDING_INSERT', version: 1 })

describe('addOrReuseItem', () => {
  it('brings back an archived row with the same name, case-insensitively, instead of inserting', () => {
    const archived = row({
      id: 'milk', name: 'Milk', quantity: '2', categoryId: 'dairy', unit: 'L', isBought: true,
      timesBought: 4, lastBoughtAt: 1000,
    })
    const createRow = vi.fn(fresh)

    const result = addOrReuseItem([archived], { name: '  mILK ', listId: 'list-1', quantity: '3' }, createRow)

    expect(createRow).not.toHaveBeenCalled()
    expect(result.reused).toBe(true)
    expect(result.itemId).toBe('milk')
    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({
      id: 'milk',
      name: 'Milk',
      isActive: true,
      isBought: false,
      quantity: '3',
      // Not given by the input, so kept.
      categoryId: 'dairy',
      unit: 'L',
      // The history is the point of reusing the row.
      timesBought: 4,
      lastBoughtAt: 1000,
      sync_state: 'PENDING_UPDATE',
      version: 4,
    })
  })

  it('keeps a row the server has never seen as an insert', () => {
    const unsent = row({ id: 'milk', sync_state: 'PENDING_INSERT', version: 1 })

    const result = addOrReuseItem([unsent], { name: 'milk', listId: 'list-1', categoryId: 'dairy' }, fresh)

    expect(result.items[0]).toMatchObject({ sync_state: 'PENDING_INSERT', version: 2, categoryId: 'dairy', quantity: '1' })
  })

  it('inserts when the only match is deleted or on another list', () => {
    const deleted = row({ id: 'gone', is_deleted: true, sync_state: 'PENDING_DELETE' })
    const elsewhere = row({ id: 'other', listId: 'list-2' })

    const result = addOrReuseItem([deleted, elsewhere], { name: 'Milk', listId: 'list-1' }, fresh)

    expect(result.reused).toBe(false)
    expect(result.itemId).toBe('new')
    expect(result.items.map(i => i.id)).toEqual(['gone', 'other', 'new'])
    expect(result.items[0]).toBe(deleted)
    expect(result.items[1]).toBe(elsewhere)
  })
})

describe('findReusableItem among duplicates already in the data', () => {
  it('prefers the row already on the list', () => {
    const items = [
      row({ id: 'archived', timesBought: 9, lastBoughtAt: 5000 }),
      row({ id: 'active', isActive: true }),
    ]
    expect(findReusableItem(items, 'list-1', 'milk')?.id).toBe('active')
  })

  it('otherwise prefers the most recently bought, then the most bought', () => {
    const items = [
      row({ id: 'often', timesBought: 9, lastBoughtAt: 1000 }),
      row({ id: 'recent', timesBought: 1, lastBoughtAt: 2000 }),
      row({ id: 'never', timesBought: 20 }),
    ]
    expect(findReusableItem(items, 'list-1', 'MILK')?.id).toBe('recent')

    const unbought = [row({ id: 'a', timesBought: 1 }), row({ id: 'b', timesBought: 2 })]
    expect(findReusableItem(unbought, 'list-1', 'milk')?.id).toBe('b')
  })

  it('matches nothing for a blank name', () => {
    expect(findReusableItem([row({ name: '' })], 'list-1', '   ')).toBeUndefined()
  })
})
