import type { GroceryItem, GroceryList, GroceryListMember, Store, Category, GroceryItemStoreInfo } from '@/types/grocery'

export function sortItems(arr: GroceryItem[]): GroceryItem[] {
  return [...arr].sort((a, b) => {
    const aDel = a.is_deleted ? 1 : 0
    const bDel = b.is_deleted ? 1 : 0
    if (aDel !== bDel) return aDel - bDel

    const aActive = a.isActive ? 1 : 0
    const bActive = b.isActive ? 1 : 0
    if (aActive !== bActive) return bActive - aActive // Active (true / 1) comes before Inactive (false / 0)

    return (a.createdAt || 0) - (b.createdAt || 0)
  })
}

export function sortLists(arr: GroceryList[]): GroceryList[] {
  return [...arr].sort((a, b) => {
    const aDel = a.is_deleted ? 1 : 0
    const bDel = b.is_deleted ? 1 : 0
    if (aDel !== bDel) return aDel - bDel

    return (a.createdAt || 0) - (b.createdAt || 0)
  })
}

export function sortMembers(arr: GroceryListMember[]): GroceryListMember[] {
  return [...arr].sort((a, b) => {
    const aDel = a.is_deleted ? 1 : 0
    const bDel = b.is_deleted ? 1 : 0
    if (aDel !== bDel) return aDel - bDel

    return (a.joinedAt || 0) - (b.joinedAt || 0)
  })
}

export function sortStores(arr: Store[]): Store[] {
  return [...arr].sort((a, b) => {
    const aDel = a.is_deleted ? 1 : 0
    const bDel = b.is_deleted ? 1 : 0
    if (aDel !== bDel) return aDel - bDel

    return (a.position || 0) - (b.position || 0)
  })
}

export function sortCategories(arr: Category[]): Category[] {
  return [...arr].sort((a, b) => {
    const aDel = a.is_deleted ? 1 : 0
    const bDel = b.is_deleted ? 1 : 0
    if (aDel !== bDel) return aDel - bDel

    return (a.position || 0) - (b.position || 0)
  })
}

export function sortStoreInfos(arr: GroceryItemStoreInfo[]): GroceryItemStoreInfo[] {
  return [...arr].sort((a, b) => {
    const aDel = a.is_deleted ? 1 : 0
    const bDel = b.is_deleted ? 1 : 0
    return aDel - bDel
  })
}
