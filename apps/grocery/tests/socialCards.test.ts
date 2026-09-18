/**
 * Lives outside src/ for the same reason tests/manifest.test.ts does: it reads
 * files off disk, and tsconfig.app.json deliberately has no node types.
 *
 * What it guards is a thing nobody can see by using the app. The link preview only
 * ever appears in somebody else's chat window, on a link they were sent, so a card
 * that has gone generic -- or one naming an og:image that is not shipped, or a
 * relative URL that every unfurler drops -- looks exactly like a working app from
 * every angle available to the person who broke it.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  applySocialCard,
  DEFAULT_CARD,
  MARKER_END,
  MARKER_START,
  ORIGIN,
  ROUTE_CARDS,
  type SocialCard,
} from '../social-cards'

const ROOT = join(import.meta.dirname, '..')
const indexHtml = readFileSync(join(ROOT, 'index.html'), 'utf8')

/** The `content` of a <meta> by its property or name attribute, in either order. */
function meta(html: string, key: string): string | undefined {
  const byFirst = html.match(
    new RegExp(`<meta\\s+(?:property|name)="${key}"\\s+content="([^"]*)"`, 'i'),
  )
  return byFirst?.[1]
}

/** Width and height straight out of the PNG header (IHDR, bytes 16-24). */
function pngSize(file: string): string {
  const header = readFileSync(join(ROOT, 'public', file))
  return `${header.readUInt32BE(16)}x${header.readUInt32BE(20)}`
}

const rendered = (card: SocialCard) => applySocialCard(indexHtml, card)

describe('index.html', () => {
  it('still has the block the build stamps the tags into', () => {
    expect(indexHtml).toContain(MARKER_START)
    expect(indexHtml).toContain(MARKER_END)
  })

  it('refuses to build if that block is gone', () => {
    const stripped = indexHtml.replace(MARKER_START, '<!-- oops -->')

    expect(() => applySocialCard(stripped, DEFAULT_CARD)).toThrow(/link-preview/)
  })

  it('replaces the block rather than adding a second title to the document', () => {
    const html = rendered(DEFAULT_CARD)

    expect(html.match(/<title>/g)).toHaveLength(1)
    expect(html.match(/og:title/g)).toHaveLength(1)
  })
})

describe('the site-wide card', () => {
  const html = rendered(DEFAULT_CARD)

  it('names a title and a description in both vocabularies', () => {
    expect(html).toContain(`<title>${DEFAULT_CARD.title}</title>`)
    expect(meta(html, 'og:title')).toBe(DEFAULT_CARD.title)
    expect(meta(html, 'description')).toBe(DEFAULT_CARD.description)
    expect(meta(html, 'og:description')).toBe(DEFAULT_CARD.description)
  })

  it('points at itself, so a shared link resolves to one page', () => {
    expect(html).toContain(`<link rel="canonical" href="${ORIGIN}/" />`)
    expect(meta(html, 'og:url')).toBe(`${ORIGIN}/`)
  })

  it('asks for the large image card, which is the only tag with no og: fallback', () => {
    expect(meta(html, 'twitter:card')).toBe('summary_large_image')
  })

  it('is indexable', () => {
    expect(meta(html, 'robots')).toBeUndefined()
  })
})

describe('the invite routes', () => {
  it('each say what the link is, rather than what the app is', () => {
    for (const card of ROUTE_CARDS) {
      expect(card.title).not.toBe(DEFAULT_CARD.title)
      expect(card.description).not.toBe(DEFAULT_CARD.description)
      expect(meta(rendered(card), 'og:title')).toBe(card.title)
    }
  })

  it('stay out of a search index', () => {
    // A live invite code in Google is a credential in Google.
    for (const card of ROUTE_CARDS) {
      expect(meta(rendered(card), 'robots')).toBe('noindex')
    }
  })

  it('claim no canonical URL, so the unfurl keeps the link that was pasted', () => {
    // The code is in the path and cannot be in a static document, so naming one
    // would be telling every crawler that every invite is a copy of one page.
    for (const card of ROUTE_CARDS) {
      const html = rendered(card)
      expect(html).not.toContain('rel="canonical"')
      expect(meta(html, 'og:url')).toBeUndefined()
    }
  })

  it('are built from the same document, so the app in them is the same app', () => {
    for (const card of ROUTE_CARDS) {
      const html = rendered(card)
      expect(html).toContain('<div id="root"></div>')
      expect(html).toContain("localStorage.getItem('grocery_theme')")
    }
  })
})

describe('the card image', () => {
  const cards = [DEFAULT_CARD, ...ROUTE_CARDS]

  it('is shipped, at the size the tags promise', () => {
    expect(existsSync(join(ROOT, 'public/og-image.png'))).toBe(true)
    expect(pngSize('og-image.png')).toBe('1200x630')

    const html = rendered(DEFAULT_CARD)
    expect(meta(html, 'og:image:width')).toBe('1200')
    expect(meta(html, 'og:image:height')).toBe('630')
  })

  it('is named absolutely on every card', () => {
    // A relative og:image is not resolved by most unfurlers; it is dropped, and
    // the preview loses its picture with nothing logged anywhere.
    for (const card of cards) {
      expect(meta(rendered(card), 'og:image')).toBe(`${ORIGIN}/og-image.png`)
    }
  })

  it('carries alt text', () => {
    expect(meta(rendered(DEFAULT_CARD), 'og:image:alt')).toBeTruthy()
  })
})

describe('the copy', () => {
  const cards = [DEFAULT_CARD, ...ROUTE_CARDS]

  it('fits what a preview actually draws', () => {
    // Roughly where the common unfurlers stop: a title past ~60 characters and a
    // description past ~200 are truncated mid-word in somebody's chat window.
    for (const card of cards) {
      expect(card.title.length, card.file).toBeLessThanOrEqual(60)
      expect(card.description.length, card.file).toBeLessThanOrEqual(200)
      expect(card.description.length, card.file).toBeGreaterThan(40)
    }
  })

  it('survives being put in an attribute', () => {
    for (const card of cards) {
      expect(card.title).not.toContain('"')
      expect(card.description).not.toContain('"')
    }
  })
})
