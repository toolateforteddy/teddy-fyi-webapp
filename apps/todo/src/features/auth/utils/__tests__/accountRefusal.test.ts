import { describe, it, expect } from 'vitest'
import { isAccountRefused } from '../accountRefusal'

describe('isAccountRefused', () => {
  it('treats a 403 as the server declining to create an account', () => {
    expect(isAccountRefused({ response: { status: 403 } })).toBe(true)
  })

  it('does not treat a rejected token as a refusal to create', () => {
    // A 401 is the token being bad. There is nothing to paste that would fix it, so
    // offering an invite field for one would be a dead end dressed as a remedy.
    expect(isAccountRefused({ response: { status: 401 } })).toBe(false)
  })

  it('does not treat an unreachable server as a refusal', () => {
    expect(isAccountRefused({ code: 'ERR_NETWORK', message: 'Network Error' })).toBe(false)
    expect(isAccountRefused({ code: 'ECONNABORTED', message: 'timeout' })).toBe(false)
  })

  it('does not treat a server-side failure as a refusal', () => {
    expect(isAccountRefused({ response: { status: 500 } })).toBe(false)
    expect(isAccountRefused({ response: { status: 502 } })).toBe(false)
  })

  it('does not treat a thrown bug as a refusal', () => {
    expect(isAccountRefused(new TypeError('undefined is not a function'))).toBe(false)
    expect(isAccountRefused(null)).toBe(false)
    expect(isAccountRefused(undefined)).toBe(false)
  })
})
