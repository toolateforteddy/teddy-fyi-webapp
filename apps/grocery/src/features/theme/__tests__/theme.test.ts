import { describe, it, expect, beforeEach } from 'vitest'
import { applyTheme } from '../applyTheme'
import { isThemePreference, STATUS_BAR_STYLES, THEME_COLORS } from '../theme'

function meta(name: string): HTMLMetaElement {
  return document.querySelector(`meta[name="${name}"]`)!
}

describe('applyTheme', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme')
    document.head.innerHTML =
      '<meta name="theme-color" content="#000000">' +
      '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">'
  })

  it('stamps the scheme on the document, which is all the stylesheet reads', () => {
    applyTheme('light')

    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('moves the browser chrome with the page', () => {
    applyTheme('light')
    expect(meta('theme-color').content).toBe(THEME_COLORS.light)

    applyTheme('dark')
    expect(meta('theme-color').content).toBe(THEME_COLORS.dark)
  })

  it('moves the iOS status bar style too', () => {
    // iOS only reads this at launch, so it is the *next* cold start this is for.
    applyTheme('light')
    expect(meta('apple-mobile-web-app-status-bar-style').content).toBe(STATUS_BAR_STYLES.light)

    applyTheme('dark')
    expect(meta('apple-mobile-web-app-status-bar-style').content).toBe(STATUS_BAR_STYLES.dark)
  })

  it('does not care whether the meta tags are there', () => {
    document.head.innerHTML = ''

    expect(() => applyTheme('light')).not.toThrow()
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})

describe('isThemePreference', () => {
  it('accepts the three the app writes', () => {
    expect(['system', 'light', 'dark'].every(isThemePreference)).toBe(true)
  })

  it('rejects whatever else is in localStorage', () => {
    // storage.getItem JSON.parses, so a key written by an older build -- or by
    // hand -- can come back as any type at all.
    expect([null, undefined, '', 'Light', 0, true, {}].some(isThemePreference)).toBe(false)
  })
})
