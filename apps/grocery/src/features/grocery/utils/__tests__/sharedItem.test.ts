import { describe, it, expect, beforeEach } from 'vitest'
import { parseSharedItem, stashSharedItem, peekSharedItem, clearSharedItem } from '../sharedItem'

const params = (query: string) => new URLSearchParams(query)

beforeEach(() => {
  localStorage.clear()
})

describe('parseSharedItem', () => {
  it('prefers the title, which is what sharing a page gives', () => {
    expect(parseSharedItem(params('title=Oat+milk&text=something&url=https://x.test'))).toBe('Oat milk')
  })

  it('falls back to the text, which is what sharing from a notes app gives', () => {
    expect(parseSharedItem(params('text=Sourdough'))).toBe('Sourdough')
  })

  it('falls back to the url rather than opening an empty sheet', () => {
    expect(parseSharedItem(params('url=https://recipes.test/pesto'))).toBe('https://recipes.test/pesto')
  })

  // Several share sheets append the link to the text on its own line. The item
  // name is the first line; the rest is not a grocery.
  it('takes only the first line', () => {
    expect(parseSharedItem(params('text=Pine+nuts%0Ahttps://recipes.test/pesto'))).toBe('Pine nuts')
  })

  it('skips a field that is present but blank', () => {
    expect(parseSharedItem(params('title=+&text=Butter'))).toBe('Butter')
  })

  it('is null when there is nothing to use', () => {
    expect(parseSharedItem(params(''))).toBeNull()
    expect(parseSharedItem(params('title=&text=&url='))).toBeNull()
  })

  it('truncates a pasted article rather than filling the field with it', () => {
    const long = 'a'.repeat(500)

    expect(parseSharedItem(params(`text=${long}`))?.length).toBe(120)
  })
})

describe('the hand-off to the add sheet', () => {
  it('returns what was stashed', () => {
    stashSharedItem('Cheddar')

    expect(peekSharedItem()).toBe('Cheddar')
  })

  // The reader renders before it clears, so a repeated peek must not consume.
  it('peeking changes nothing', () => {
    stashSharedItem('Cheddar')

    expect(peekSharedItem()).toBe('Cheddar')
    expect(peekSharedItem()).toBe('Cheddar')
  })

  // One shot: a reload after adding the item must not reopen the sheet with it.
  it('is gone once cleared', () => {
    stashSharedItem('Cheddar')
    clearSharedItem()

    expect(peekSharedItem()).toBeNull()
  })

  it('is null when nothing was shared', () => {
    expect(peekSharedItem()).toBeNull()
  })

  it('ignores a blank stash rather than opening an empty sheet', () => {
    stashSharedItem('   ')

    expect(peekSharedItem()).toBeNull()
  })
})
