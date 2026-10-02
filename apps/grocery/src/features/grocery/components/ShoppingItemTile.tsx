import { memo } from 'react'
import { CheckSquare, Square } from 'lucide-react'
import type { GroceryItem } from '@/types/grocery'

interface ShoppingItemTileProps {
  item: GroceryItem
  /**
   * Which section the tile sits in: still to buy, in the "Not usually here" tray, or
   * already in the cart.
   */
  variant: 'toBuy' | 'offMapping' | 'inCart'
  /** The stores an off-mapping item is usually bought at, already joined for display. */
  usuallyAt?: string
  onToggle: (itemId: string) => void
}

/**
 * One item on the Shopping screen.
 *
 * Memoised for the same reason as the Need screen's GroceryItemTile: ticking one item off
 * changes one row, and with a stable `onToggle` and an unchanged row keeping its identity,
 * only that tile re-renders rather than every tile in every aisle.
 */
export const ShoppingItemTile = memo(function ShoppingItemTile({
  item,
  variant,
  usuallyAt,
  onToggle
}: ShoppingItemTileProps) {
  if (variant === 'offMapping') {
    return (
      <button
        onClick={() => onToggle(item.id)}
        className="flex items-center justify-between p-3 h-12 rounded-lg bg-surface-tile border border-dashed border-line active:scale-95 transition-all text-left cursor-pointer group/item"
      >
        <span className="min-w-0 pr-2">
          <span className="block text-sm font-semibold truncate text-text-secondary group-hover/item:text-primary">
            {item.name}
          </span>
          {usuallyAt && (
            <span className="block text-[10px] text-text-subtle truncate">
              Usually {usuallyAt}
            </span>
          )}
        </span>
        <Square className="w-4 h-4 text-text-muted shrink-0" />
      </button>
    )
  }

  if (variant === 'inCart') {
    return (
      <button
        onClick={() => onToggle(item.id)}
        className="flex items-center justify-between p-3 h-12 rounded-lg bg-surface-tile border border-success/25 text-left line-through cursor-pointer"
      >
        <span className="text-sm font-medium truncate text-text-muted">
          {item.name}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-text-subtle bg-inset px-1.5 py-0.5 rounded border border-line">
            {item.quantity}
          </span>
          <CheckSquare className="w-4 h-4 text-success" />
        </div>
      </button>
    )
  }

  return (
    <button
      onClick={() => onToggle(item.id)}
      className="flex items-center justify-between p-3 h-12 rounded-lg bg-surface-tile border border-line-faint active:scale-95 transition-all text-left cursor-pointer group"
    >
      <span className="text-sm font-semibold truncate text-text-primary pr-2 group-hover:text-primary">
        {item.name}
      </span>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-[10px] text-text-muted bg-inset px-1.5 py-0.5 rounded border border-line">
          {item.quantity}
        </span>
        <Square className="w-4 h-4 text-text-muted" />
      </div>
    </button>
  )
})
