import { describe, it, expect } from 'vitest'
import { apiErrorMessage } from '../apiError'

/**
 * The service sends `{"error": "..."}` and three call sites read `data.message`, so every
 * message the server took the trouble to write was thrown away. The one that mattered:
 * `POST /api/lists/join` answers 429 "Too many invalid invite codes; try again later"
 * once an account has failed five times in ten minutes, and the join sheet rendered
 * "Failed to join list. Please check the code and try again." over the top of it.
 */
describe('apiErrorMessage', () => {
  it('reads the error field this API actually sends', () => {
    const err = { response: { data: { error: 'Invalid or expired invite code' } } }
    expect(apiErrorMessage(err, 'fallback')).toBe('Invalid or expired invite code')
  })

  it('surfaces the rate-limit message rather than telling people to re-check the code', () => {
    const err = { response: { data: { error: 'Too many invalid invite codes; try again later' } } }
    expect(apiErrorMessage(err, 'Failed to join list. Please check the code and try again.'))
      .toBe('Too many invalid invite codes; try again later')
  })

  it('still reads message, for anything in front of the service that uses that spelling', () => {
    const err = { response: { data: { message: 'Bad gateway' } } }
    expect(apiErrorMessage(err, 'fallback')).toBe('Bad gateway')
  })

  it('prefers error over message when both are present', () => {
    const err = { response: { data: { error: 'from the service', message: 'from a proxy' } } }
    expect(apiErrorMessage(err, 'fallback')).toBe('from the service')
  })

  it('accepts a plain string body', () => {
    expect(apiErrorMessage({ response: { data: 'Service Unavailable' } }, 'fallback'))
      .toBe('Service Unavailable')
  })

  it('falls back when there is no response at all, which is what a dead network looks like', () => {
    expect(apiErrorMessage(new Error('Network Error'), 'fallback')).toBe('fallback')
    expect(apiErrorMessage(undefined, 'fallback')).toBe('fallback')
    expect(apiErrorMessage({ response: { data: { error: '   ' } } }, 'fallback')).toBe('fallback')
    expect(apiErrorMessage({ response: { data: { error: 42 } } }, 'fallback')).toBe('fallback')
  })
})
