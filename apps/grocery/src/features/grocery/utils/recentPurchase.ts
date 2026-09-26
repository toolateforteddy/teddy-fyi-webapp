import type { GroceryItem } from '@/types/grocery'

/**
 * How long an item stays out of the recommendations after a trip that bought it.
 *
 * A recommendation is something the list has bought before and does not need now, and without
 * this everything a trip just bought is exactly that the moment the trip is archived: the milk
 * that is in the fridge heads the tray. Thirty-six hours rather than a day, so a Saturday-morning
 * shop is still hidden on Sunday evening.
 *
 * Android carries the same window (`grocery/domain/RecentPurchase.kt`); change one and change
 * the other.
 */
export const RECENT_PURCHASE_WINDOW_MS = 36 * 60 * 60 * 1000

/**
 * Whether `item` was bought within the window of `now`. An item with no `lastBoughtAt` --
 * bought before the field existed, or never -- is not recent, which is how every item behaved
 * before. A time in the future (another device's clock running ahead) counts as recent.
 */
export function isRecentlyBought(item: Pick<GroceryItem, 'lastBoughtAt'>, now: number): boolean {
  if (item.lastBoughtAt == null) return false
  return now - item.lastBoughtAt < RECENT_PURCHASE_WINDOW_MS
}
