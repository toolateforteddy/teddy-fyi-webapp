import { describe, it, expect } from 'vitest'
import { MIN_RECOMMENDATIONS, recommendationsThatFit } from '../recommendationLimit'

describe('recommendationsThatFit', () => {
  it('fills the room a short list leaves with whole rows', () => {
    // A 360px phone column is two columns; 450px is ten 36px rows with 10px gaps between.
    expect(recommendationsThatFit(360, 450)).toBe(20)
  })

  it('does not count a row that would be cut in half', () => {
    expect(recommendationsThatFit(360, 450 + 35)).toBe(20)
    expect(recommendationsThatFit(360, 450 + 46)).toBe(22)
  })

  it('never offers fewer than the floor, however little room is left', () => {
    expect(recommendationsThatFit(360, 82)).toBe(MIN_RECOMMENDATIONS)
    expect(recommendationsThatFit(0, 0)).toBe(MIN_RECOMMENDATIONS)
  })
})
