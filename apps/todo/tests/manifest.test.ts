/**
 * Lives outside src/ on purpose: it reads files off disk, and tsconfig.app.json
 * deliberately has no node types. tsconfig.node.json, which does, includes this
 * directory, so `tsc -b` still checks it.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const PUBLIC = join(import.meta.dirname, '../public')
const manifest = JSON.parse(readFileSync(join(PUBLIC, 'manifest.webmanifest'), 'utf8'))

/** Every asset path the manifest names, as `public/`-relative file paths. */
function referencedAssets(): string[] {
  const icons = (list: { src: string }[] | undefined) => (list || []).map(i => i.src)
  return [
    ...icons(manifest.icons),
    ...(manifest.shortcuts || []).flatMap((s: { icons?: { src: string }[] }) => icons(s.icons)),
  ]
}

/**
 * A manifest that names a file which is not there fails silently: Chrome drops the
 * screenshot, or the whole install dialog, with nothing in the console. These
 * assets are generated (see the PR that added them), so nothing else catches a
 * rename.
 */
/** Width and height straight out of the PNG header (IHDR, bytes 16-24). */
function pngSize(src: string): string {
  const header = readFileSync(join(PUBLIC, src.replace(/^\//, '')))
  return `${header.readUInt32BE(16)}x${header.readUInt32BE(20)}`
}

/**
 * Whether a PNG can carry transparency, from the colour type in its header (IHDR
 * byte 25): 4 is greyscale+alpha and 6 is truecolour+alpha. A palette image (3)
 * could in principle carry a tRNS chunk, but build-icons.py writes only RGB.
 */
function hasAlpha(src: string): boolean {
  const header = readFileSync(join(PUBLIC, src.replace(/^\//, '')))
  return header.readUInt8(25) === 4 || header.readUInt8(25) === 6
}

describe('the web manifest', () => {
  it('names only assets that are actually shipped', () => {
    const missing = referencedAssets().filter(src => !existsSync(join(PUBLIC, src.replace(/^\//, ''))))

    expect(missing).toEqual([])
  })

  it('offers shortcuts that stay inside the app scope and name a real tab', () => {
    expect(manifest.shortcuts.length).toBeGreaterThan(0)
    for (const shortcut of manifest.shortcuts) {
      expect(shortcut.name).toBeTruthy()
      expect(shortcut.url.startsWith(manifest.scope)).toBe(true)
      expect(shortcut.url).toMatch(/^\/\?mode=(BACKLOG|PLANNING|TODAY|SCHEDULED)$/)
    }
  })

  // The declared size is not decoration: Chrome rejects an icon whose real size
  // does not match, and a generated asset is exactly the thing that silently comes
  // back at the wrong scale.
  it('declares the real pixel size of every generated asset', () => {
    const declared = [
      ...manifest.icons,
      ...manifest.shortcuts.flatMap((s: { icons?: { src: string; sizes: string }[] }) => s.icons || []),
    ].filter((asset: { src: string }) => asset.src.endsWith('.png'))

    const wrong = declared
      .map((asset: { src: string; sizes: string }) => ({ src: asset.src, declared: asset.sizes, actual: pngSize(asset.src) }))
      .filter(a => a.declared !== a.actual)

    expect(wrong).toEqual([])
  })

  // A user agent that recognises none of the purposes on an icon must ignore that
  // icon, so bundling several onto one entry is how a browser that only knows
  // `any` ends up with no icon at all. One purpose per entry is what degrades.
  // There is deliberately no monochrome icon (icons/README.md says why).
  it('gives every icon exactly one purpose, and covers both', () => {
    const purposes = manifest.icons.map((i: { purpose: string }) => i.purpose)

    expect(purposes.every((p: string) => !p.includes(' '))).toBe(true)
    expect(new Set(purposes)).toEqual(new Set(['any', 'maskable']))
  })

  // iOS composites a transparent home-screen icon onto black, and a launcher's mask shows
  // whatever is behind a transparent corner, so every icon carries its own paper.
  it('ships opaque icons', () => {
    for (const icon of manifest.icons) {
      expect(hasAlpha(icon.src), `${icon.src} (${icon.purpose})`).toBe(false)
    }
  })

  // Chrome mints a WebAPK's launcher icon from the maskable one when there is one; without
  // it the mark is shrunk onto a white plate inside the launcher's shape.
  it('names a maskable icon of at least 192px', () => {
    const maskable = manifest.icons.filter((i: { purpose: string }) => i.purpose === 'maskable')
    expect(maskable.some((i: { sizes: string }) => Number(i.sizes.split('x')[0]) >= 192)).toBe(true)
  })

  it('opens the app at the root of this origin, standalone', () => {
    expect(manifest.start_url).toBe('/')
    expect(manifest.scope).toBe('/')
    expect(manifest.display).toBe('standalone')
  })
})
