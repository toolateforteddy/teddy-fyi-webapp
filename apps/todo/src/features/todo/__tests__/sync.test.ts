import { describe, expect, it } from 'vitest'
import { mergeItems, type SyncResult } from '../sync'
import { itemToWire, toDelta } from '../wire'
import type { TodoItem } from '../types'

function item(overrides: Partial<TodoItem>): TodoItem {
  return {
    id: 'a',
    title: 'Task',
    isCompleted: false,
    createdAt: 1,
    position: 0,
    scheduledDate: null,
    recurrenceRule: null,
    scheduledAt: 1,
    userId: 'u',
    parentId: null,
    isDaily: false,
    dueDate: null,
    description: null,
    listId: null,
    priority: 0,
    icon: null,
    lastScheduledDate: null,
    syncState: 'SYNCED',
    version: 1,
    isDeleted: false,
    ...overrides,
  }
}

function result(sent: TodoItem[], overrides: Partial<SyncResult> = {}): SyncResult {
  return {
    serverTimestamp: 't',
    successIds: new Set(sent.map((s) => s.id)),
    uploadVersions: new Map(),
    remoteLists: [],
    remoteItems: [],
    sentLists: new Map(),
    sentItems: new Map(sent.map((s) => [s.id, JSON.stringify(s)])),
    ...overrides,
  }
}

describe('toDelta', () => {
  it('sends a delete without data and an insert with snake_case data', () => {
    expect(toDelta(item({ isDeleted: true, syncState: 'PENDING_DELETE' }), itemToWire)).toEqual({
      id: 'a',
      type: 'DELETE',
      version: 1,
      data: null,
    })
    const insert = toDelta(item({ syncState: 'PENDING_INSERT', listId: 'l' }), itemToWire)
    expect(insert.type).toBe('INSERT')
    expect(insert.data).toMatchObject({ list_id: 'l', is_completed: false, sync_state: 'PENDING_INSERT', is_deleted: false })
    expect(Object.keys(insert.data!).every((k) => k === k.toLowerCase())).toBe(true)
  })
})

describe('mergeItems', () => {
  it('marks an acknowledged row synced at the server version', () => {
    const sent = item({ syncState: 'PENDING_UPDATE', version: 2 })
    const merged = mergeItems([sent], result([sent], { uploadVersions: new Map([['a', 5]]) }))
    expect(merged[0]).toMatchObject({ syncState: 'SYNCED', version: 5 })
  })

  it('leaves an unacknowledged row dirty', () => {
    const sent = item({ syncState: 'PENDING_UPDATE' })
    const merged = mergeItems([sent], result([sent], { successIds: new Set() }))
    expect(merged[0].syncState).toBe('PENDING_UPDATE')
  })

  it('keeps a row edited again in flight dirty, as an update', () => {
    const sent = item({ syncState: 'PENDING_INSERT' })
    const edited = { ...sent, title: 'Changed' }
    const merged = mergeItems([edited], result([sent], { uploadVersions: new Map([['a', 1]]) }))
    expect(merged[0]).toMatchObject({ title: 'Changed', syncState: 'PENDING_UPDATE' })
  })

  it('drops an acknowledged delete', () => {
    const sent = item({ isDeleted: true, syncState: 'PENDING_DELETE' })
    expect(mergeItems([sent], result([sent]))).toEqual([])
  })

  it("takes the server's icon from the echo of a row it just accepted", () => {
    const sent = item({ syncState: 'PENDING_INSERT' })
    const echo = { id: 'a', type: 'UPDATE' as const, version: 2, data: { ...itemToWire(sent), icon: 'Home', version: 2 } }
    const merged = mergeItems([sent], result([sent], { uploadVersions: new Map([['a', 1]]), remoteItems: [echo] }))
    expect(merged[0]).toMatchObject({ icon: 'Home', version: 2, syncState: 'SYNCED' })
  })

  it('does not let a remote row overwrite an unsent local edit', () => {
    const local = item({ title: 'Mine', syncState: 'PENDING_UPDATE', version: 3 })
    const remote = { id: 'a', type: 'UPDATE' as const, version: 4, data: { ...itemToWire(item({ title: 'Theirs' })), version: 4 } }
    const merged = mergeItems([local], result([], { remoteItems: [remote] }))
    expect(merged[0]).toMatchObject({ title: 'Mine', syncState: 'PENDING_UPDATE', version: 4 })
  })

  it('applies remote rows and tombstones, keeping the local-only rollover marker', () => {
    const local = item({ lastScheduledDate: '2026-10-11', version: 1 })
    const remote = [
      { id: 'a', type: 'UPDATE' as const, version: 2, data: { ...itemToWire(item({ title: 'New' })), version: 2 } },
      { id: 'b', type: 'UPDATE' as const, version: 1, data: itemToWire(item({ id: 'b' })) },
      { id: 'b', type: 'DELETE' as const, version: 2, data: { ...itemToWire(item({ id: 'b' })), is_deleted: true } },
    ]
    const merged = mergeItems([local], result([], { remoteItems: remote }))
    expect(merged).toHaveLength(1)
    expect(merged[0]).toMatchObject({ title: 'New', lastScheduledDate: '2026-10-11', version: 2 })
  })
})
