/**
 * The two schemes: what they are called and the few values about them that are
 * not CSS.
 *
 * The palette itself lives in packages/shared/theme.css. What has to be
 * duplicated here is anything a <meta> tag needs, because a meta tag cannot read
 * a custom property -- there is a test that fails when these drift from the
 * stylesheet.
 *
 * Deliberately touches no DOM, which is what lets tests/theme.test.ts read it:
 * that project has node types and no DOM lib. Applying a scheme to the document
 * is applyTheme.ts next door.
 */

/** What the user chose. 'system' is the default and follows the OS. */
export type ThemePreference = 'system' | 'light' | 'dark'

/** What is actually on screen once 'system' has been resolved. */
export type ResolvedTheme = 'light' | 'dark'

export const THEME_PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark']

/**
 * The colour the browser paints its own chrome with -- Android's title bar, the
 * iOS status bar area, the task-switcher card. It has to be the page colour, so
 * these are --palette-canvas for each scheme, copied.
 */
export const THEME_COLORS: Record<ResolvedTheme, string> = {
  dark: '#000000',
  light: '#F7F2FA',
}

/**
 * iOS reads this one *at launch* and never again, so switching themes inside a
 * running installed app leaves the old status bar until it is next opened cold.
 * Kept in sync anyway, because the launch after the switch is the one that
 * matters.
 *
 * 'black-translucent' puts the page under the status bar and draws its text
 * white, which is right on black and unreadable on a light page; 'default'
 * starts the viewport below the bar instead. Every top-level surface pads with
 * env(safe-area-inset-top), which is 0 under 'default', so the layout is
 * correct either way.
 */
export const STATUS_BAR_STYLES: Record<ResolvedTheme, string> = {
  dark: 'black-translucent',
  light: 'default',
}

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark'
}
