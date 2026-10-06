// The recommendation grid's geometry, which the tray's count is worked out from: 140px
// columns, h-9 pills and gap-2.5, as PlanningPhase draws them.
const MIN_COLUMN_PX = 140
const TILE_PX = 36
const GAP_PX = 10

/** Suggestions offered however little room there is; past what fits, the tray scrolls. */
export const MIN_RECOMMENDATIONS = 10

/** The tray never shrinks below two rows, however long the list. */
export const TRAY_MIN_HEIGHT_PX = TILE_PX * 2 + GAP_PX

/** How many suggestions fill whole rows of a tray this big, and never fewer than the floor. */
export function recommendationsThatFit(width: number, height: number): number {
  const columns = Math.max(1, Math.floor((width + GAP_PX) / (MIN_COLUMN_PX + GAP_PX)))
  const rows = Math.floor((height + GAP_PX) / (TILE_PX + GAP_PX))
  return Math.max(MIN_RECOMMENDATIONS, rows * columns)
}
