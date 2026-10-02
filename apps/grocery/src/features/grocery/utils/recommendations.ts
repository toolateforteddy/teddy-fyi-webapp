import type { GroceryItem } from '@/types/grocery'
import { isRecentlyBought } from './recentPurchase'

/**
 * One recommendation per name from the list's purchase history. The caller orders them.
 *
 * Adding an item now reuses its row, but households already have several rows for one name
 * from before that, and each of them used to become its own tile -- the same word twice in the
 * tray, and two buttons with one React key. So the rows are gathered by name first:
 *
 * - The 36-hour hold reads the *latest* purchase of any of them. Judged row by row, an older
 *   twin that was not bought on this trip would put the milk that is in the fridge straight
 *   back in the tray.
 * - The counts are *summed*, not maxed. Each twin was bought on different trips -- the trip
 *   only ever increments the row that was on the list -- so the sum is how often the name was
 *   actually bought, which is what the tray is ordered by. The max would rank a staple split
 *   across three rows below something bought a few times on one.
 * - A name with any row still on the list is not a recommendation at all; the caller's
 *   planned-items filter drops it, and an active row is never a candidate here.
 *
 * The tile shows the spelling and category of the row bought most often. Which row a tap
 * brings back is findReusableItem's choice, and it matches on the name case-insensitively, so
 * the spelling shown does not decide it.
 */
export function recommendationsFromHistory(
  items: readonly GroceryItem[],
  listId: string,
  now: number
): { name: string; categoryId: string; timesBought: number }[] {
  const byName = new Map<string, { lead: GroceryItem; timesBought: number; lastBoughtAt?: number }>()
  for (const item of items) {
    if (item.listId !== listId || item.isActive || item.is_deleted || !(item.timesBought > 0)) continue
    const key = item.name.trim().toLowerCase()
    const group = byName.get(key)
    if (!group) {
      byName.set(key, { lead: item, timesBought: item.timesBought, lastBoughtAt: item.lastBoughtAt })
      continue
    }
    group.timesBought += item.timesBought
    if (item.lastBoughtAt != null && (group.lastBoughtAt == null || item.lastBoughtAt > group.lastBoughtAt)) {
      group.lastBoughtAt = item.lastBoughtAt
    }
    if (item.timesBought > group.lead.timesBought) group.lead = item
  }

  return [...byName.values()]
    .filter(group => !isRecentlyBought(group, now))
    .map(group => ({
      name: group.lead.name,
      categoryId: group.lead.categoryId || '1',
      timesBought: group.timesBought,
    }))
}
