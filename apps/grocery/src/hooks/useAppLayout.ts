import { useMediaQuery } from './useMediaQuery'

/**
 * A phone held sideways leaves roughly 330px of usable height. A 56px top bar
 * plus a 68px bottom bar eats more than a third of that, so below this
 * threshold the navigation moves to a side rail instead, which costs width the
 * landscape viewport has plenty of.
 */
const SHORT_VIEWPORT = '(max-height: 560px)'

/**
 * Landscape *and* short: a small tablet in landscape (tall enough) keeps the
 * bottom bar, which is where a thumb expects it.
 */
const RAIL_QUERY = `(orientation: landscape) and ${SHORT_VIEWPORT}`

export type NavPlacement = 'bottom' | 'rail'

export interface AppLayout {
  /** Where the primary navigation lives on the current viewport. */
  nav: NavPlacement
  /** True when vertical space is tight enough to warrant a shorter top bar. */
  compact: boolean
}

export function useAppLayout(): AppLayout {
  const isRail = useMediaQuery(RAIL_QUERY)
  const isShort = useMediaQuery(SHORT_VIEWPORT)

  return {
    nav: isRail ? 'rail' : 'bottom',
    compact: isShort,
  }
}
