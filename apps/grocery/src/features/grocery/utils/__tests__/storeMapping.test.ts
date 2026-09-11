import { describe, it, expect } from 'vitest'
import type { GroceryItemStoreInfo } from '@/types/grocery'
import { mappedStoreIds, isOffMappingAtStore, addStoreMapping } from '../storeMapping'

const info = (overrides: Partial<GroceryItemStoreInfo> = {}): GroceryItemStoreInfo => ({
  groceryItemId: 'item-1',
  storeId: 'store-1',
  isAvailable: true,
  listId: 'list-1',
  sync_state: 'SYNCED',
  version: 1,
  is_deleted: false,
  ...overrides,
})

describe('mappedStoreIds', () => {
  it('returns the stores an item is available at on this list', () => {
    const infos = [
      info({ storeId: 'store-1' }),
      info({ storeId: 'store-2' }),
      info({ groceryItemId: 'item-2', storeId: 'store-3' }),
    ]

    expect(mappedStoreIds(infos, 'item-1', 'list-1')).toEqual(['store-1', 'store-2'])
  })

  it('ignores deleted rows, unavailable rows and rows from another list', () => {
    const infos = [
      info({ storeId: 'store-1', is_deleted: true }),
      info({ storeId: 'store-2', isAvailable: false }),
      info({ storeId: 'store-3', listId: 'list-2' }),
    ]

    expect(mappedStoreIds(infos, 'item-1', 'list-1')).toEqual([])
  })
})

describe('isOffMappingAtStore', () => {
  it('is true for an item mapped only to another store', () => {
    expect(isOffMappingAtStore([info({ storeId: 'store-2' })], 'item-1', 'list-1', 'store-1')).toBe(true)
  })

  it('is false for an item mapped to this store', () => {
    const infos = [info({ storeId: 'store-1' }), info({ storeId: 'store-2' })]

    expect(isOffMappingAtStore(infos, 'item-1', 'list-1', 'store-1')).toBe(false)
  })

  it('is false for an item mapped nowhere, which is shown at every store', () => {
    expect(isOffMappingAtStore([], 'item-1', 'list-1', 'store-1')).toBe(false)
  })
})

describe('addStoreMapping', () => {
  it('inserts a pending row for a pair that has none', () => {
    const updated = addStoreMapping([info({ storeId: 'store-2' })], 'item-1', 'store-1', 'list-1')

    expect(updated).toHaveLength(2)
    expect(updated[1]).toEqual({
      groceryItemId: 'item-1',
      storeId: 'store-1',
      isAvailable: true,
      listId: 'list-1',
      sync_state: 'PENDING_INSERT',
      version: 1,
      is_deleted: false,
    })
  })

  it('revives a deleted row rather than adding a second row for the pair', () => {
    const infos = [info({ is_deleted: true, isAvailable: false, sync_state: 'PENDING_DELETE', version: 3 })]

    const updated = addStoreMapping(infos, 'item-1', 'store-1', 'list-1')

    expect(updated).toHaveLength(1)
    expect(updated[0]).toMatchObject({
      isAvailable: true,
      is_deleted: false,
      sync_state: 'PENDING_UPDATE',
      version: 4,
    })
  })

  it('keeps a row the server has never seen an insert', () => {
    const infos = [info({ isAvailable: false, sync_state: 'PENDING_INSERT' })]

    expect(addStoreMapping(infos, 'item-1', 'store-1', 'list-1')[0].sync_state).toBe('PENDING_INSERT')
  })

  it('matches an existing row whatever its listId says, since the server computes that field', () => {
    const infos = [info({ listId: undefined, isAvailable: false })]

    const updated = addStoreMapping(infos, 'item-1', 'store-1', 'list-1')

    expect(updated).toHaveLength(1)
    expect(updated[0].isAvailable).toBe(true)
  })

  it('returns the same array when the mapping already exists', () => {
    const infos = [info()]

    expect(addStoreMapping(infos, 'item-1', 'store-1', 'list-1')).toBe(infos)
  })
})
