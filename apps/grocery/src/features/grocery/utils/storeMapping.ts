import type { GroceryItemStoreInfo } from '@/types/grocery'

/**
 * Which stores an item is currently mapped to on the given list.
 *
 * "Currently" is the same three conditions the shopping filter has always used:
 * the row belongs to this list, it has not been deleted, and it says the item is
 * available. A row for a store the item is *not* available at is not a mapping.
 */
export function mappedStoreIds(
  infos: GroceryItemStoreInfo[],
  itemId: string,
  listId: string
): string[] {
  return infos
    .filter(
      info =>
        info.groceryItemId === itemId &&
        info.listId === listId &&
        !info.is_deleted &&
        info.isAvailable
    )
    .map(info => info.storeId)
}

/**
 * True when an item is mapped to at least one store and this store is not one of
 * them -- the item the shopping list hides while you are isolated to that store.
 *
 * An item mapped nowhere is not off-mapping: "no mapping" means "could be
 * anywhere", which is why those items show at every store.
 */
export function isOffMappingAtStore(
  infos: GroceryItemStoreInfo[],
  itemId: string,
  listId: string,
  storeId: string
): boolean {
  const mapped = mappedStoreIds(infos, itemId, listId)
  return mapped.length > 0 && !mapped.includes(storeId)
}

/**
 * Add a store to an item's mapping, reviving a row that is deleted or marked
 * unavailable rather than inserting a second row for the same pair.
 *
 * The server keys `grocery_item_store_info` by (item, store), so a duplicate row
 * is not a second mapping -- it is two local rows racing to own one remote one.
 * The existing-row lookup deliberately ignores `listId`: the field is
 * server-computed and can be absent on a row this client did not create, and a
 * row matching the pair is the same row whatever it says about the list.
 *
 * Returns the same array reference when the mapping already exists, so a caller
 * in a setState updater does not mark the collection dirty for nothing.
 */
export function addStoreMapping(
  infos: GroceryItemStoreInfo[],
  itemId: string,
  storeId: string,
  listId: string
): GroceryItemStoreInfo[] {
  const existingIndex = infos.findIndex(
    info => info.groceryItemId === itemId && info.storeId === storeId
  )

  if (existingIndex === -1) {
    return [
      ...infos,
      {
        groceryItemId: itemId,
        storeId,
        isAvailable: true,
        listId,
        sync_state: 'PENDING_INSERT',
        version: 1,
        is_deleted: false
      }
    ]
  }

  const existing = infos[existingIndex]
  if (!existing.is_deleted && existing.isAvailable) {
    return infos
  }

  return infos.map((info, idx) =>
    idx === existingIndex
      ? {
          ...info,
          isAvailable: true,
          is_deleted: false,
          // A row that has never reached the server stays an insert; re-flagging
          // it as an update would ask the server to patch a row it has no copy of.
          sync_state: existing.sync_state === 'PENDING_INSERT' ? 'PENDING_INSERT' : 'PENDING_UPDATE',
          version: info.version + 1
        }
      : info
  )
}
