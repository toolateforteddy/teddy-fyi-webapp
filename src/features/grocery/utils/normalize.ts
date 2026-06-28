import type { GroceryItem, GroceryList, GroceryListMember, Store, Category, GroceryItemStoreInfo } from '@/types/grocery'

export function normalizeItem(item: any): GroceryItem {
  const remoteRaw = item || {}
  return {
    ...item,
    listId: remoteRaw.listId || remoteRaw.list_id || '',
    categoryId: remoteRaw.categoryId || remoteRaw.category_id,
    createdAt: remoteRaw.createdAt || remoteRaw.created_at,
    isActive: remoteRaw.isActive !== undefined ? remoteRaw.isActive : remoteRaw.is_active,
    isBought: remoteRaw.isBought !== undefined ? remoteRaw.isBought : remoteRaw.is_bought,
    timesBought: remoteRaw.timesBought !== undefined ? remoteRaw.timesBought : remoteRaw.times_bought,
    userId: remoteRaw.userId || remoteRaw.user_id,
  }
}

export function normalizeList(list: any): GroceryList {
  const remoteRaw = list || {}
  return {
    ...list,
    ownerId: remoteRaw.ownerId || remoteRaw.owner_id,
    createdAt: remoteRaw.createdAt || remoteRaw.created_at,
  }
}

export function normalizeListMember(member: any): GroceryListMember {
  const remoteRaw = member || {}
  return {
    ...member,
    listId: remoteRaw.listId || remoteRaw.list_id || '',
    userId: remoteRaw.userId || remoteRaw.user_id || '',
    joinedAt: remoteRaw.joinedAt || remoteRaw.joined_at,
  }
}

export function normalizeStore(store: any): Store {
  const remoteRaw = store || {}
  return {
    ...store,
    listId: remoteRaw.listId || remoteRaw.list_id || '',
    isDefaultSupported: remoteRaw.isDefaultSupported !== undefined ? remoteRaw.isDefaultSupported : remoteRaw.is_default_supported,
    userId: remoteRaw.userId || remoteRaw.user_id,
  }
}

export function normalizeCategory(cat: any): Category {
  const remoteRaw = cat || {}
  return {
    ...cat,
    listId: remoteRaw.listId || remoteRaw.list_id || '',
    userId: remoteRaw.userId || remoteRaw.user_id,
  }
}

export function normalizeStoreInfo(info: any): GroceryItemStoreInfo {
  const remoteRaw = info || {}
  return {
    ...info,
    listId: remoteRaw.listId || remoteRaw.list_id || '',
    groceryItemId: remoteRaw.groceryItemId || remoteRaw.grocery_item_id || '',
    storeId: remoteRaw.storeId || remoteRaw.store_id || '',
    isAvailable: remoteRaw.isAvailable !== undefined ? remoteRaw.isAvailable : remoteRaw.is_available,
    userId: remoteRaw.userId || remoteRaw.user_id,
  }
}
