import { describe, it, expect, vi } from 'vitest'
import { keepUnchangedRows } from '../keepUnchangedRows'

interface Row { id: string; name: string; sync_state: string }

const byName = (rows: Row[]) => [...rows].sort((a, b) => a.name.localeCompare(b.name))

describe('keepUnchangedRows', () => {
  it('hands back the previous array when the merge touched nothing', () => {
    const prev: Row[] = [
      { id: 'b', name: 'Bread', sync_state: 'SYNCED' },
      { id: 'a', name: 'Apples', sync_state: 'SYNCED' },
    ]
    const normalize = vi.fn((row: Row) => ({ ...row }))

    const next = keepUnchangedRows(prev, [...prev], normalize, byName)

    expect(next).toBe(prev)
    expect(normalize).not.toHaveBeenCalled()
  })

  it('keeps the identity of untouched rows and normalises only the changed one', () => {
    const apples = { id: 'a', name: 'Apples', sync_state: 'SYNCED' }
    const bread = { id: 'b', name: 'Bread', sync_state: 'PENDING_UPDATE' }
    const syncedBread = { ...bread, sync_state: 'SYNCED' }
    const normalize = vi.fn((row: Row) => ({ ...row }))

    const next = keepUnchangedRows([apples, bread], [apples, syncedBread], normalize, byName)

    expect(next).not.toBe([apples, bread])
    expect(next[0]).toBe(apples)
    expect(next[1]).toEqual(syncedBread)
    expect(normalize).toHaveBeenCalledTimes(1)
  })

  it('treats an added or removed row as a change', () => {
    const apples = { id: 'a', name: 'Apples', sync_state: 'SYNCED' }
    const bread = { id: 'b', name: 'Bread', sync_state: 'SYNCED' }
    const identity = (row: Row) => row

    expect(keepUnchangedRows([apples, bread], [apples], identity, byName)).toEqual([apples])
    expect(keepUnchangedRows([apples], [apples, bread], identity, byName)).toEqual([apples, bread])
  })
})
