import type { Category, Store } from '@/types/grocery'
import { generateUuid } from '@/utils/uuid'
import { storage } from '@/utils/storage'
import { STORAGE_KEYS } from '@/config/storageKeys'

/**
 * The categories a new list can start with in one tap.
 *
 * In the order a shopper usually meets them, with the cold things last: Shopping
 * groups by category in `position` order, so this order is the walk through the
 * store and Dairy and Frozen spend the least time in the cart. The icons are all
 * from CategoryConfigPanel's presets, so they look chosen rather than imported.
 *
 * Android carries the same nine in the same order (`StarterCategories.kt`); change
 * one and change the other.
 */
export const STARTER_CATEGORIES: ReadonlyArray<{ name: string; icon: string }> = [
  { name: 'Produce', icon: '🥦' },
  { name: 'Bread', icon: '🍞' },
  { name: 'Meat', icon: '🥩' },
  { name: 'Pantry', icon: '🥫' },
  { name: 'Snacks', icon: '🍿' },
  { name: 'Beverages', icon: '🥤' },
  { name: 'Household', icon: '🧼' },
  { name: 'Dairy', icon: '🥛' },
  { name: 'Frozen', icon: '🍦' },
]

const liveOn = <T extends { listId?: string; is_deleted: boolean }>(rows: T[], listId: string) =>
  rows.filter(r => r.listId === listId && !r.is_deleted)

const nameKey = (name: string) => name.trim().toLocaleLowerCase()

/** What a list is missing, which is what the setup sheet asks about. */
export function listSetupNeeds(listId: string, stores: Store[], categories: Category[]) {
  return {
    needsStores: liveOn(stores, listId).length === 0,
    needsCategories: liveOn(categories, listId).length === 0,
  }
}

/**
 * New category rows for every starter the list does not already have by name.
 *
 * Skipping by name rather than refusing when the list has any category means a
 * second tap, or a tap after adding "Produce" by hand, adds only what is missing.
 */
export function buildStarterCategories(listId: string, existing: Category[]): Category[] {
  const live = liveOn(existing, listId)
  const taken = new Set(live.map(c => nameKey(c.name)))
  const nextPosition = live.reduce((max, c) => Math.max(max, c.position), 0) + 1

  return STARTER_CATEGORIES
    .filter(starter => !taken.has(nameKey(starter.name)))
    .map((starter, i) => ({
      id: generateUuid(),
      name: starter.name,
      icon: starter.icon,
      position: nextPosition + i,
      listId,
      sync_state: 'PENDING_INSERT' as const,
      version: 1,
      is_deleted: false,
    }))
}

/** New store rows for the typed names, trimmed, de-duplicated, and skipping ones the list has. */
export function buildStores(listId: string, names: string[], existing: Store[]): Store[] {
  const live = liveOn(existing, listId)
  const taken = new Set(live.map(s => nameKey(s.name)))
  let nextPosition = live.reduce((max, s) => Math.max(max, s.position), 0) + 1

  const rows: Store[] = []
  for (const raw of names) {
    const name = raw.trim()
    if (!name || taken.has(nameKey(name))) continue
    taken.add(nameKey(name))
    rows.push({
      id: generateUuid(),
      name,
      position: nextPosition++,
      isDefaultSupported: false,
      listId,
      sync_state: 'PENDING_INSERT',
      version: 1,
      is_deleted: false,
    })
  }
  return rows
}

/**
 * Lists this device has already offered the setup sheet for.
 *
 * Offered once per list, answered or not: somebody who skips it has said no, and
 * somebody who shops with no stores on purpose should not be asked every launch.
 * The Categories panel and the Shopping tab keep their own ways in for later.
 */
function offeredListIds(): string[] {
  const offered = storage.getItem<unknown>(STORAGE_KEYS.LIST_SETUP_OFFERED, [])
  return Array.isArray(offered) ? offered.filter((id): id is string => typeof id === 'string') : []
}

export function hasOfferedListSetup(listId: string): boolean {
  return offeredListIds().includes(listId)
}

export function markListSetupOffered(listId: string): void {
  const offered = offeredListIds()
  if (offered.includes(listId)) return
  storage.setItem(STORAGE_KEYS.LIST_SETUP_OFFERED, [...offered, listId])
}
