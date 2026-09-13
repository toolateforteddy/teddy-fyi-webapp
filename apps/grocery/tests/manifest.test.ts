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
    ...icons(manifest.screenshots),
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
 * could in principle carry a tRNS chunk, but build-icons.py only quantises images
 * it has already flattened onto an opaque background.
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

  it('offers shortcuts that stay inside the app scope', () => {
    expect(manifest.shortcuts.length).toBeGreaterThan(0)
    for (const shortcut of manifest.shortcuts) {
      expect(shortcut.name).toBeTruthy()
      expect(shortcut.url.startsWith(manifest.scope)).toBe(true)
    }
  })

  // Chrome only shows the richer install dialog when at least one narrow
  // screenshot is present, and it requires the declared size to be the real one.
  it('declares narrow screenshots for the install dialog', () => {
    const narrow = manifest.screenshots.filter((s: { form_factor: string }) => s.form_factor === 'narrow')

    expect(narrow.length).toBeGreaterThan(0)
    for (const shot of narrow) {
      expect(shot.sizes).toMatch(/^\d+x\d+$/)
      expect(shot.label).toBeTruthy()
    }
  })

  // The declared size is not decoration: Chrome rejects an icon whose real size
  // does not match, and a generated asset is exactly the thing that silently comes
  // back at the wrong scale.
  it('declares the real pixel size of every generated asset', () => {
    const declared = [
      ...manifest.icons,
      ...manifest.screenshots,
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
  it('gives every icon exactly one purpose, and covers all three', () => {
    const purposes = manifest.icons.map((i: { purpose: string }) => i.purpose)

    expect(purposes.every((p: string) => !p.includes(' '))).toBe(true)
    expect(new Set(purposes)).toEqual(new Set(['any', 'maskable', 'monochrome']))
  })

  // The two that carry a background have to be opaque. iOS composites a
  // transparent home-screen icon onto black, which turns the brown outlines of
  // this mark into a silhouette; the monochrome one is the exact opposite, and is
  // nothing *but* its transparency.
  it('ships opaque icons for `any` and `maskable`, and a stencil for `monochrome`', () => {
    for (const icon of manifest.icons) {
      const opaque = !hasAlpha(icon.src)

      expect(opaque, `${icon.src} (${icon.purpose})`).toBe(icon.purpose !== 'monochrome')
    }
  })

  it('points the share target at a route the app actually serves', () => {
    expect(manifest.share_target.action).toBe('/share')
    expect(manifest.share_target.method).toBe('GET')
    expect(manifest.share_target.params).toEqual({ title: 'title', text: 'text', url: 'url' })
  })
})
