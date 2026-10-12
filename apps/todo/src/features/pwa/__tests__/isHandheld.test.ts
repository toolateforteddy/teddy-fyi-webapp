import { describe, it, expect, afterEach } from 'vitest'
import { isHandheld } from '../install'

/** jsdom has no matchMedia, so every case here installs one. */
function setPointer(pointer: 'coarse' | 'fine') {
  Object.defineProperty(window, 'matchMedia', {
    value: (query: string) => ({ matches: query.includes(pointer), media: query }),
    configurable: true,
  })
}

afterEach(() => {
  Object.defineProperty(window, 'matchMedia', { value: undefined, configurable: true })
})

describe('isHandheld', () => {
  it('is true when the primary pointer is a finger', () => {
    setPointer('coarse')

    expect(isHandheld()).toBe(true)
  })

  // The case this was added for: Chrome fires beforeinstallprompt on a laptop too.
  it('is false for a mouse', () => {
    setPointer('fine')

    expect(isHandheld()).toBe(false)
  })

  // Withholding the offer is the safe direction: Settings still has the button.
  it('is false where matchMedia does not exist at all', () => {
    expect(isHandheld()).toBe(false)
  })
})
