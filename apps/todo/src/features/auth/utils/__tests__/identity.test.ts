import { describe, it, expect } from 'vitest'
import { rowUserId, legacyRowUserId } from '../identity'
import type { User } from '../../types'

const subject = '1078234509876543210'
const surrogate = '3f2b1c04-9f3a-4a7e-8f21-6a0d5d5c9b11'

describe('rowUserId', () => {
  it('is the surrogate when the server has sent one', () => {
    const user: User = { id: subject, surrogateId: surrogate, email: 'a@b.c' }
    expect(rowUserId(user)).toBe(surrogate)
  })

  it('falls back to the subject against a server older than the re-key', () => {
    const user: User = { id: subject, email: 'a@b.c' }
    expect(rowUserId(user)).toBe(subject)
  })

  it('is undefined when nobody is signed in', () => {
    expect(rowUserId(null)).toBeUndefined()
    expect(rowUserId(undefined)).toBeUndefined()
  })
})

describe('legacyRowUserId', () => {
  it('is the subject once the surrogate is known, so old rows can be found', () => {
    const user: User = { id: subject, surrogateId: surrogate, email: 'a@b.c' }
    expect(legacyRowUserId(user)).toBe(subject)
  })

  it('is undefined until the surrogate arrives: the subject is not stale yet', () => {
    const user: User = { id: subject, email: 'a@b.c' }
    expect(legacyRowUserId(user)).toBeUndefined()
  })

  it('is undefined when the two ids are the same value', () => {
    const user: User = { id: surrogate, surrogateId: surrogate, email: 'a@b.c' }
    expect(legacyRowUserId(user)).toBeUndefined()
  })
})
