import { describe, it, expect } from 'vitest'
import type { Category, Store } from '@/types/grocery'
import {
  STARTER_CATEGORIES,
  buildStarterCategories,
  buildStores,
  hasOfferedListSetup,
  listSetupNeeds,
  markListSetupOffered,
} from '../listSetup'

const category = (over: Partial<Category>): Category => ({
  id: 'c', name: 'X', position: 1, listId: 'list-1',
  sync_state: 'SYNCED', version: 1, is_deleted: false, ...over,
})

const store = (over: Partial<Store>): Store => ({
  id: 's', name: 'X', position: 1, isDefaultSupported: false, listId: 'list-1',
  sync_state: 'SYNCED', version: 1, is_deleted: false, ...over,
})

describe('the starter categories', () => {
  it('include the six asked for, and put the cold things last', () => {
    const names = STARTER_CATEGORIES.map(c => c.name)
    for (const asked of ['Dairy', 'Frozen', 'Produce', 'Meat', 'Bread', 'Pantry']) {
      expect(names).toContain(asked)
    }
    expect(names.slice(-2)).toEqual(['Dairy', 'Frozen'])
  })

  it('become pending rows on the list, in order, after anything already there', () => {
    const rows = buildStarterCategories('list-1', [category({ name: 'Pets', position: 4 })])

    expect(rows).toHaveLength(STARTER_CATEGORIES.length)
    expect(rows.map(r => r.name)).toEqual(STARTER_CATEGORIES.map(c => c.name))
    expect(rows.map(r => r.position)).toEqual(rows.map((_, i) => 5 + i))
    expect(new Set(rows.map(r => r.id)).size).toBe(rows.length)
    for (const row of rows) {
      expect(row).toMatchObject({ listId: 'list-1', sync_state: 'PENDING_INSERT', version: 1, is_deleted: false })
      expect(row.icon).toBeTruthy()
    }
  })

  it('skip a name the list already has, whatever its case, but not one on another list or deleted', () => {
    const rows = buildStarterCategories('list-1', [
      category({ id: 'a', name: 'produce' }),
      category({ id: 'b', name: 'Dairy', listId: 'list-2' }),
      category({ id: 'c', name: 'Frozen', is_deleted: true }),
    ])

    const names = rows.map(r => r.name)
    expect(names).not.toContain('Produce')
    expect(names).toContain('Dairy')
    expect(names).toContain('Frozen')
  })
})

describe('buildStores', () => {
  it('trims, drops blanks and duplicates, and skips stores the list has', () => {
    const rows = buildStores('list-1', ['  Aldi ', '', 'aldi', 'Costco', 'Target'], [store({ name: 'target', position: 2 })])

    expect(rows.map(r => r.name)).toEqual(['Aldi', 'Costco'])
    expect(rows.map(r => r.position)).toEqual([3, 4])
    expect(rows[0]).toMatchObject({ listId: 'list-1', sync_state: 'PENDING_INSERT', isDefaultSupported: false })
  })
})

describe('listSetupNeeds', () => {
  it('looks only at live rows on the list asked about', () => {
    expect(listSetupNeeds('list-1', [store({ listId: 'list-2' })], [category({ is_deleted: true })]))
      .toEqual({ needsStores: true, needsCategories: true })
    expect(listSetupNeeds('list-1', [store({})], []))
      .toEqual({ needsStores: false, needsCategories: true })
  })
})

describe('the once-per-list offer', () => {
  it('is remembered per list', () => {
    expect(hasOfferedListSetup('list-1')).toBe(false)
    markListSetupOffered('list-1')
    markListSetupOffered('list-1')
    expect(hasOfferedListSetup('list-1')).toBe(true)
    expect(hasOfferedListSetup('list-2')).toBe(false)
  })

  it('survives a stored value that is not a list of ids', () => {
    localStorage.setItem('grocery_list_setup_offered', '"list-1"')
    expect(hasOfferedListSetup('list-1')).toBe(false)
    markListSetupOffered('list-1')
    expect(hasOfferedListSetup('list-1')).toBe(true)
  })
})
