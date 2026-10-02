import type { GroceryItem } from '@/types/grocery'

/** What an add path knows about the item it is adding. */
export interface AddItemInput {
  name: string
  listId: string
  /** Absent means "keep what the existing row says", or '1' on a fresh row. */
  quantity?: string
  /** Absent means "keep what the existing row says", or uncategorised on a fresh row. */
  categoryId?: string
  /** Absent means "keep what the existing row says", or no unit on a fresh row. */
  unit?: string
}

/**
 * The row on `listId` that adding `name` should bring back, if there is one.
 *
 * An item is one row for its whole life on a list -- needed, bought, archived, needed again --
 * which is what Android's `GroceryViewModel.insertItem` does and what the purchase history
 * hangs off: `timesBought` and `lastBoughtAt` live on the row, so a second row for the same
 * name starts that history again from nothing and the recommendations show the name twice.
 *
 * Matched case-insensitively and ignoring surrounding whitespace, as Android does. A deleted
 * row is not a candidate: it is on its way off the server and reviving it would race the
 * delete. Data from before this existed can already hold several rows with one name, so the
 * choice among them is deliberate: a row already on the list wins, since adding something
 * already needed should change that row and not resurrect a twin; after that the one most
 * recently bought, then the one bought most often, because that is the row whose history the
 * 36-hour hold and the tray's ordering read.
 */
export function findReusableItem(
  items: readonly GroceryItem[],
  listId: string,
  name: string
): GroceryItem | undefined {
  const key = nameKey(name)
  if (!key) return undefined

  let best: GroceryItem | undefined
  for (const item of items) {
    if (item.listId !== listId || item.is_deleted || nameKey(item.name) !== key) continue
    if (!best || ranksAbove(item, best)) best = item
  }
  return best
}

/**
 * `items` with `input` added: the matching row brought back onto the list if there is one,
 * otherwise a fresh row built by `createRow` and appended.
 *
 * A reused row keeps its id, name, position and purchase history, and takes the quantity,
 * category and unit from `input` only where `input` gives one. It is marked as an ordinary
 * local edit -- `PENDING_UPDATE` unless it has never reached the server, with the version
 * bumped -- the same way every other edit in the app is, so the sync pushes it as an update
 * to the row the server already has.
 *
 * `createRow` is only called on the insert path, so a caller can mint the id inside it.
 */
export function addOrReuseItem(
  items: readonly GroceryItem[],
  input: AddItemInput,
  createRow: () => GroceryItem
): { items: GroceryItem[]; itemId: string; reused: boolean } {
  const existing = findReusableItem(items, input.listId, input.name)
  if (!existing) {
    const row = createRow()
    return { items: [...items, row], itemId: row.id, reused: false }
  }

  const revived: GroceryItem = {
    ...existing,
    isActive: true,
    isBought: false,
    quantity: input.quantity || existing.quantity,
    categoryId: input.categoryId ?? existing.categoryId,
    unit: input.unit ?? existing.unit,
    sync_state: existing.sync_state === 'PENDING_INSERT' ? 'PENDING_INSERT' : 'PENDING_UPDATE',
    version: existing.version + 1,
  }
  return {
    items: items.map(item => (item === existing ? revived : item)),
    itemId: existing.id,
    reused: true,
  }
}

function nameKey(name: string): string {
  return name.trim().toLowerCase()
}

function ranksAbove(a: GroceryItem, b: GroceryItem): boolean {
  if (a.isActive !== b.isActive) return a.isActive
  const aBought = a.lastBoughtAt ?? -Infinity
  const bBought = b.lastBoughtAt ?? -Infinity
  if (aBought !== bBought) return aBought > bBought
  return (a.timesBought || 0) > (b.timesBought || 0)
}
