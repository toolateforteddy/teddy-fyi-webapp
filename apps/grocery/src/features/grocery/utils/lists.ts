import type { GroceryList } from '@/types/grocery'
import { generateUuid } from '@/utils/uuid'

/**
 * Creating, renaming and deleting a list, as pure updates to the list rows.
 *
 * The same three moves as Android's `GroceryRepository`, and deliberately no more: a new
 * list is one row and nothing else. No membership row is written for it. Membership is the
 * server's to grant -- the sync endpoint creates the creator's row itself when a new list
 * arrives, and never takes a member row from a client -- so one minted here would stay local
 * forever beside the server's.
 */

export function newList(name: string, ownerId: string | undefined): GroceryList {
  return {
    id: generateUuid(),
    name: name.trim(),
    ownerId,
    createdAt: Date.now(),
    sync_state: 'PENDING_INSERT',
    version: 1,
    is_deleted: false,
  }
}

export function renameList(lists: GroceryList[], id: string, name: string): GroceryList[] {
  const trimmed = name.trim()
  if (!trimmed) return lists
  return lists.map(list => {
    if (list.id !== id || list.name === trimmed) return list
    return {
      ...list,
      name: trimmed,
      // A rename must not turn a pending insert or delete into an update.
      sync_state: list.sync_state === 'SYNCED' ? 'PENDING_UPDATE' : list.sync_state,
    }
  })
}

/**
 * A list the server has never seen is simply dropped; any other is marked for deletion so
 * the next sync takes it off the server too.
 */
export function deleteList(lists: GroceryList[], id: string): GroceryList[] {
  return lists.flatMap(list => {
    if (list.id !== id) return [list]
    if (list.sync_state === 'PENDING_INSERT') return []
    return [{ ...list, is_deleted: true, sync_state: 'PENDING_DELETE' as const }]
  })
}
