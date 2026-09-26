import { describe, expect, it } from 'vitest'
import { RECENT_PURCHASE_WINDOW_MS, isRecentlyBought } from '../recentPurchase'

describe('isRecentlyBought', () => {
  const now = 1_000_000_000_000

  it('is thirty-six hours', () => {
    expect(RECENT_PURCHASE_WINDOW_MS).toBe(36 * 60 * 60 * 1000)
  })

  it('treats an item never stamped as not recent', () => {
    expect(isRecentlyBought({}, now)).toBe(false)
    expect(isRecentlyBought({ lastBoughtAt: undefined }, now)).toBe(false)
  })

  it('is recent inside the window', () => {
    expect(isRecentlyBought({ lastBoughtAt: now }, now)).toBe(true)
    expect(isRecentlyBought({ lastBoughtAt: now - RECENT_PURCHASE_WINDOW_MS + 1 }, now)).toBe(true)
  })

  it('is not recent at or past the window', () => {
    expect(isRecentlyBought({ lastBoughtAt: now - RECENT_PURCHASE_WINDOW_MS }, now)).toBe(false)
    expect(isRecentlyBought({ lastBoughtAt: now - 2 * RECENT_PURCHASE_WINDOW_MS }, now)).toBe(false)
  })

  it('counts a clock running ahead of ours as recent', () => {
    expect(isRecentlyBought({ lastBoughtAt: now + 60_000 }, now)).toBe(true)
  })
})
