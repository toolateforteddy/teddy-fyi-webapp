import type { ResolvedTheme } from './theme'
import { STATUS_BAR_STYLES, THEME_COLORS } from './theme'

/**
 * Applies a resolved scheme to the document.
 *
 * `data-theme` is the only thing the stylesheet reads; the two meta tags are
 * for the browser rather than the page. Safe to call before React has mounted,
 * which is what index.html's inline copy of this does.
 */
export function applyTheme(resolved: ResolvedTheme): void {
  if (typeof document === 'undefined') return

  document.documentElement.dataset.theme = resolved

  const themeColor = document.querySelector('meta[name="theme-color"]')
  if (themeColor) themeColor.setAttribute('content', THEME_COLORS[resolved])

  const statusBar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')
  if (statusBar) statusBar.setAttribute('content', STATUS_BAR_STYLES[resolved])
}
