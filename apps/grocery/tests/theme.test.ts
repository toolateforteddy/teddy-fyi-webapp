/**
 * Lives outside src/ for the same reason tests/manifest.test.ts does: it reads
 * files off disk, and tsconfig.app.json deliberately has no node types.
 *
 * What it guards is the one thing the type system cannot: the palette is
 * declared in CSS, named again in TypeScript, and copied a third time into an
 * inline script in index.html -- because a <meta> tag cannot read a custom
 * property and a module cannot run before first paint. Three copies of a colour
 * drift silently; a light-mode launch that flashes black, or an Android title
 * bar in the wrong scheme, is the kind of bug nobody files.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { THEME_COLORS, STATUS_BAR_STYLES } from '../src/features/theme/theme'

const ROOT = join(import.meta.dirname, '..')
// Comments stripped first: the prose in theme.css names tokens, and a sentence
// mentioning --palette-text-primary otherwise reads as a declaration of it that
// runs on until the next semicolon.
const css = readFileSync(join(ROOT, '../../packages/shared/theme.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const html = readFileSync(join(ROOT, 'index.html'), 'utf8')

/** The `--palette-*` declarations of one block, by name. */
function paletteBlock(selector: string): Record<string, string> {
  const start = css.indexOf(selector + ' {')
  expect(start, `${selector} block`).toBeGreaterThan(-1)
  const body = css.slice(start, css.indexOf('\n}', start))
  const out: Record<string, string> = {}
  for (const [, name, value] of body.matchAll(/(--(?:palette|shadow)-[a-z-]+):\s*([^;]+);/g)) {
    out[name] = value.trim()
  }
  return out
}

const dark = paletteBlock(':root')
const light = paletteBlock(":root[data-theme='light']")

describe('the palette', () => {
  it('declares every token in both schemes', () => {
    expect(Object.keys(light).sort()).toEqual(Object.keys(dark).sort())
  })

  it('is not one scheme with a few values changed', () => {
    // Not a style rule -- a token that is the same in both is usually a token
    // somebody forgot. The two that are the same on purpose: a scrim is a wash
    // over the page behind a dialog, and a pale wash pushes nothing back; and
    // text on a red fill is white either way, because the fill is dark in both.
    const shared = Object.keys(dark).filter((k) => dark[k] === light[k])

    expect(shared.sort()).toEqual(['--palette-on-danger', '--palette-scrim'])
  })

  it('agrees with the theme-color TypeScript uses', () => {
    expect(THEME_COLORS.dark.toLowerCase()).toBe(dark['--palette-canvas'].toLowerCase())
    expect(THEME_COLORS.light.toLowerCase()).toBe(light['--palette-canvas'].toLowerCase())
  })
})

describe("index.html's pre-paint script", () => {
  it('reads the same storage key the app writes', () => {
    expect(html).toContain("localStorage.getItem('grocery_theme')")
  })

  it('paints the same two page colours', () => {
    expect(html).toContain(`'${THEME_COLORS.light}'`)
    expect(html).toContain(`'${THEME_COLORS.dark}'`)
  })

  it('sets the same two iOS status bar styles', () => {
    expect(html).toContain(`'${STATUS_BAR_STYLES.light}'`)
    expect(html).toContain(`'${STATUS_BAR_STYLES.dark}'`)
  })

  it('falls back to dark when anything throws', () => {
    // localStorage throws in a locked-down browser, and matchMedia is missing in
    // some embedded ones. Either way this app was dark for its whole life.
    expect(html).toMatch(/catch \(e\) \{\s*document\.documentElement\.setAttribute\('data-theme', 'dark'\)/)
  })
})
