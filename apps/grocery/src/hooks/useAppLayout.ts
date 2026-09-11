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

/**
 * Wide enough for a rail, and tall enough that this is not a phone on its side.
 *
 * 600px is the Android app's own compact/medium breakpoint
 * (`MEDIUM_WIDTH_BREAKPOINT_DP` in `GroceryScreen.kt`), so the two clients change
 * shape at the same width. The height half is what keeps every phone -- portrait
 * *and* landscape -- on exactly the layout it has today: a 844x390 phone is wider
 * than 600px, and without the second clause it would get the tablet treatment.
 */
const TABLET = `(min-width: 600px) and (min-height: 561px)`

/**
 * Where the add-item form stops being a modal over the list and becomes a pane
 * beside it. Android docks at 720dp; the web needs more, because 320px of pane
 * plus a 176px rail plus padding leaves a 720px viewport one single column of
 * tiles -- which is a worse trade than the sheet it replaced. 1000px is the
 * narrowest width that still leaves room for two columns beside the pane.
 */
const DOCKED_ADD_PANE = `(min-width: 1000px) and (min-height: 561px)`

export type NavPlacement = 'bottom' | 'rail'

export interface AppLayout {
  /** Where the primary navigation lives on the current viewport. */
  nav: NavPlacement
  /** True when vertical space is tight enough to warrant a shorter top bar. */
  compact: boolean
  /**
   * Whether the rail has room to name its destinations. False on the landscape
   * phone that the rail was originally for, where width is the scarce thing.
   */
  railLabels: boolean
  /** True on a tablet-or-larger viewport: the shell fills the screen. */
  wide: boolean
  /** Whether the add-item form docks beside the list instead of opening over it. */
  dockAddPane: boolean
}

export function useAppLayout(): AppLayout {
  const isShortRail = useMediaQuery(RAIL_QUERY)
  const isShort = useMediaQuery(SHORT_VIEWPORT)
  const isTablet = useMediaQuery(TABLET)
  const canDockAddPane = useMediaQuery(DOCKED_ADD_PANE)

  return {
    nav: isShortRail || isTablet ? 'rail' : 'bottom',
    compact: isShort,
    railLabels: isTablet,
    wide: isTablet,
    dockAddPane: canDockAddPane,
  }
}
