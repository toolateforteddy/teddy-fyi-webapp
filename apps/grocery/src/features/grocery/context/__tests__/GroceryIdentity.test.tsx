import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { GroceryProvider, useGrocery } from '../GroceryContext'
import { storage } from '@/utils/storage'
import { STORAGE_KEYS } from '@/config/storageKeys'
import type { User } from '@/features/auth/types'

const SUBJECT = '1078234509876543210'
const SURROGATE = '3f2b1c04-9f3a-4a7e-8f21-6a0d5d5c9b11'
const CO_MEMBER = '8c17a2de-4b6f-4c11-9a03-2f7e1b4d6a55'

// Mutable so each case can decide whether the surrogate has arrived yet.
let mockUser: User | null = { id: SUBJECT, surrogateId: SURROGATE, email: 'test@example.com' }
vi.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: () => ({ user: mockUser, isLoading: false })
}))

const mockSyncNow = vi.fn().mockResolvedValue(null)
const passthrough = vi.fn((local: unknown) => local)
const syncHook = () => ({
  syncNow: mockSyncNow,
  resolveConflicts: passthrough,
  resolveListConflicts: passthrough,
  resolveListMemberConflicts: passthrough,
  resolveStoreConflicts: passthrough,
  resolveCategoryConflicts: passthrough,
  resolveStoreInfoConflicts: passthrough,
  isSyncing: false,
})
vi.mock('@/features/sync/hooks/useGrocerySync', () => ({
  useGrocerySync: () => syncHook(),
  default: () => syncHook(),
}))

function Consumer() {
  const { lists, listMembers, handleManualSync } = useGrocery()
  return (
    <div>
      <div data-testid="lists">{JSON.stringify(lists.map(l => [l.id, l.ownerId, l.sync_state]))}</div>
      <div data-testid="members">{JSON.stringify(listMembers.map(m => [m.id, m.userId, m.sync_state]))}</div>
      <button data-testid="sync" onClick={handleManualSync}>Sync</button>
    </div>
  )
}

function renderProvider() {
  return render(
    <GroceryProvider>
      <Consumer />
    </GroceryProvider>
  )
}

const emptySyncResponse = {
  server_timestamp: '2026-09-10T18:00:00Z',
  remote_grocery_changes: [],
  remote_grocery_list_changes: [],
  remote_grocery_list_member_changes: [],
  remote_store_changes: [],
  remote_category_changes: [],
  remote_grocery_item_store_info_changes: [],
}

describe('grocery row identity after the surrogate re-key', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockUser = { id: SUBJECT, surrogateId: SURROGATE, email: 'test@example.com' }
    mockSyncNow.mockReset()
    mockSyncNow.mockResolvedValue(null)
  })

  it('rewrites a list still owned by the pre-re-key subject, without dirtying it', () => {
    storage.setItem(STORAGE_KEYS.LISTS, [
      { id: 'list-1', name: 'My List', ownerId: SUBJECT, sync_state: 'SYNCED', version: 3, is_deleted: false },
    ])

    renderProvider()

    expect(JSON.parse(screen.getByTestId('lists').textContent!)).toEqual([
      ['list-1', SURROGATE, 'SYNCED'],
    ])
  })

  it("rewrites this account's membership row but leaves a co-member alone", () => {
    storage.setItem(STORAGE_KEYS.LISTS, [
      { id: 'list-1', name: 'Shared', ownerId: CO_MEMBER, sync_state: 'SYNCED', version: 1, is_deleted: false },
    ])
    storage.setItem(STORAGE_KEYS.LIST_MEMBERS, [
      { id: 'mem-mine', listId: 'list-1', userId: SUBJECT, role: 'MEMBER', sync_state: 'SYNCED', version: 1, is_deleted: false },
      { id: 'mem-theirs', listId: 'list-1', userId: CO_MEMBER, role: 'OWNER', sync_state: 'SYNCED', version: 1, is_deleted: false },
    ])

    renderProvider()

    const members = JSON.parse(screen.getByTestId('members').textContent!)
    expect(members).toContainEqual(['mem-mine', SURROGATE, 'SYNCED'])
    expect(members).toContainEqual(['mem-theirs', CO_MEMBER, 'SYNCED'])
  })

  it("leaves a shared list's owner alone", () => {
    storage.setItem(STORAGE_KEYS.LISTS, [
      { id: 'list-1', name: 'Shared', ownerId: CO_MEMBER, sync_state: 'SYNCED', version: 1, is_deleted: false },
    ])

    renderProvider()

    expect(JSON.parse(screen.getByTestId('lists').textContent!)).toEqual([
      ['list-1', CO_MEMBER, 'SYNCED'],
    ])
  })

  it('keeps the subject when the server has not sent a surrogate', () => {
    mockUser = { id: SUBJECT, email: 'test@example.com' }
    storage.setItem(STORAGE_KEYS.LISTS, [
      { id: 'list-1', name: 'My List', ownerId: SUBJECT, sync_state: 'SYNCED', version: 1, is_deleted: false },
    ])

    renderProvider()

    expect(JSON.parse(screen.getByTestId('lists').textContent!)).toEqual([
      ['list-1', SUBJECT, 'SYNCED'],
    ])
  })

  it('keys the seeded default list and its membership by the surrogate', async () => {
    mockSyncNow.mockResolvedValueOnce(emptySyncResponse)

    renderProvider()

    await act(async () => {
      fireEvent.click(screen.getByTestId('sync'))
    })

    const [list] = JSON.parse(screen.getByTestId('lists').textContent!)
    const [member] = JSON.parse(screen.getByTestId('members').textContent!)
    expect(list[1]).toBe(SURROGATE)
    expect(member[1]).toBe(SURROGATE)
  })
})
