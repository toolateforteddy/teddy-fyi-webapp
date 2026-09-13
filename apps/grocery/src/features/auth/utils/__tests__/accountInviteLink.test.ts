import { describe, it, expect } from 'vitest'
import {
  inviteCodeFromRouteParam,
  isInviteCodeShaped,
} from '../accountInviteLink'

const CODE = 'eyJ0eXAiOiJKV1QifQ.eyJlbWFpbCI6Im11bUBleGFtcGxlLmNvbSJ9.c2lnbmF0dXJl'

describe('accountInviteLink', () => {
  it('accepts the three-segment shape the server mints', () => {
    expect(isInviteCodeShaped(CODE)).toBe(true)
    expect(inviteCodeFromRouteParam(CODE)).toBe(CODE)
  })

  /**
   * The failure this exists to catch. A link that lost its tail is the common one -- there is
   * far more of this code to truncate than of a list invite's eight characters -- and refusing
   * it here is what lets the page say so instead of sending somebody through a Google sign-in
   * to reach a refusal that cannot explain itself.
   */
  it('refuses anything short of a whole code', () => {
    expect(inviteCodeFromRouteParam('eyJ0eXAiOiJKV1QifQ.eyJlbWFpbA')).toBeNull()
    expect(inviteCodeFromRouteParam('eyJ0eXAiOiJKV1QifQ')).toBeNull()
    expect(inviteCodeFromRouteParam('')).toBeNull()
    expect(inviteCodeFromRouteParam(undefined)).toBeNull()
    // A base64 `+` or `/` is not base64url, so it did not come from here.
    expect(inviteCodeFromRouteParam('ab+c.de/f.ghi')).toBeNull()
  })

  it('survives a link somebody edited by hand', () => {
    expect(inviteCodeFromRouteParam(`  ${CODE}  `)).toBe(CODE)
    // A lone `%` makes decodeURIComponent throw; the raw segment is still usable.
    expect(inviteCodeFromRouteParam('%')).toBeNull()
  })
})
