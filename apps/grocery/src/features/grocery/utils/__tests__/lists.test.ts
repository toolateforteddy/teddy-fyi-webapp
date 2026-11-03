import { describe, it, expect } from 'vitest'
import type { GroceryList } from '@/types/grocery'
import { deleteList, newList, renameList } from '../lists'

const row = (id: string, sync_state: GroceryList['sync_state'] = 'SYNCED'): GroceryList => ({
  id, name: id, createdAt: 1, sync_state, version: 1, is_deleted: false,
})

describe('list rows', () => {
  it('makes a new list as one pending insert, trimmed', () => {
    const list = newList('  Costco run ', 'owner-1')
    expect(list).toMatchObject({ name: 'Costco run', ownerId: 'owner-1', sync_state: 'PENDING_INSERT', is_deleted: false })
  })

  it('marks a synced list for update on rename, and leaves a pending insert pending', () => {
    const lists = [row('a'), row('b', 'PENDING_INSERT')]
    expect(renameList(lists, 'a', 'Home')[0]).toMatchObject({ name: 'Home', sync_state: 'PENDING_UPDATE' })
    expect(renameList(lists, 'b', 'Cabin')[1]).toMatchObject({ name: 'Cabin', sync_state: 'PENDING_INSERT' })
  })

  it('ignores a blank rename', () => {
    const lists = [row('a')]
    expect(renameList(lists, 'a', '   ')).toBe(lists)
  })

  it('drops a list the server never saw, and marks any other for deletion', () => {
    const lists = [row('a'), row('b', 'PENDING_INSERT')]
    expect(deleteList(lists, 'b')).toEqual([row('a')])
    expect(deleteList(lists, 'a')[0]).toMatchObject({ is_deleted: true, sync_state: 'PENDING_DELETE' })
  })
})
