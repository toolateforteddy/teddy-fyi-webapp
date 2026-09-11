import { describe, it, expect } from 'vitest'
import { isSessionRejected } from '../sessionFailure'

describe('isSessionRejected', () => {
  it('treats a 401 as the server refusing the session', () => {
    expect(isSessionRejected({ response: { status: 401 } })).toBe(true)
  })

  it('treats a 403 as the server refusing the session', () => {
    expect(isSessionRejected({ response: { status: 403 } })).toBe(true)
  })

  it('does not treat an unreachable server as a refusal', () => {
    // What Axios throws with no signal: a rejection carrying no response at all.
    expect(isSessionRejected({ code: 'ERR_NETWORK', message: 'Network Error' })).toBe(false)
    expect(isSessionRejected({ code: 'ECONNABORTED', message: 'timeout of 10000ms exceeded' })).toBe(false)
  })

  it('does not treat a server-side failure as a refusal', () => {
    // A 502 from the ingress says nothing about whether the session is still good.
    expect(isSessionRejected({ response: { status: 500 } })).toBe(false)
    expect(isSessionRejected({ response: { status: 502 } })).toBe(false)
    expect(isSessionRejected({ response: { status: 503 } })).toBe(false)
  })

  it('does not treat a thrown bug as a refusal', () => {
    // The safe direction: a TypeError in our own handler must not sign anyone out.
    expect(isSessionRejected(new TypeError('undefined is not a function'))).toBe(false)
    expect(isSessionRejected(null)).toBe(false)
    expect(isSessionRejected(undefined)).toBe(false)
  })
})
