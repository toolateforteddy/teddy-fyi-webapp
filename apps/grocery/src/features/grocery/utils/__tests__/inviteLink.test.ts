import { describe, it, expect } from 'vitest'
import {
  INVITE_CODE_LENGTH,
  inviteCodeFromPastedText,
  inviteCodeFromRouteParam,
  inviteLinkFor,
  isCompleteInviteCode,
  normalizeInviteCode,
} from '../inviteLink'

describe('normalizeInviteCode', () => {
  it('folds a code the way the server does', () => {
    // `normalize_code` in src/routes/lists/handlers.rs: non-alphanumerics dropped, the rest
    // uppercased. A code that survives one and not the other is a 403 the sender cannot
    // explain, and it spends one of five attempts saying so.
    expect(normalizeInviteCode(' cdfh-2345 ')).toBe('CDFH2345')
  })
})

describe('inviteLinkFor', () => {
  it('points at the join route on this origin', () => {
    expect(inviteLinkFor('CDFH2345')).toBe(`${window.location.origin}/join/CDFH2345`)
  })

  it('normalizes before building, so the link is never one nobody can redeem', () => {
    expect(inviteLinkFor('cdfh 2345')).toBe(`${window.location.origin}/join/CDFH2345`)
  })
})

describe('inviteCodeFromRouteParam', () => {
  it('reads the code a link carries', () => {
    expect(inviteCodeFromRouteParam('CDFH2345')).toBe('CDFH2345')
    expect(inviteCodeFromRouteParam('cdfh2345')).toBe('CDFH2345')
  })

  it('refuses anything that is not a whole code', () => {
    // A truncated link is the common failure -- a messaging app that wrapped the URL, or a
    // link read out loud. Rejecting it here means the sender is told to share again, rather
    // than the recipient spending one of the account's five join attempts on it.
    expect(inviteCodeFromRouteParam('CDFH23')).toBeNull()
    expect(inviteCodeFromRouteParam('CDFH2345XYZ')).toBeNull()
    expect(inviteCodeFromRouteParam('')).toBeNull()
    expect(inviteCodeFromRouteParam(undefined)).toBeNull()
  })

  it('survives a percent sign somebody left in the URL', () => {
    // decodeURIComponent throws on a lone `%`, which would take the page down rather than
    // show the "incomplete link" copy.
    expect(() => inviteCodeFromRouteParam('CDFH234%')).not.toThrow()
    expect(inviteCodeFromRouteParam('CDFH234%')).toBeNull()
    expect(inviteCodeFromRouteParam('%43DFH2345')).toBe('CDFH2345')
  })
})

describe('inviteCodeFromPastedText', () => {
  it('takes the code out of a pasted link', () => {
    expect(inviteCodeFromPastedText('https://grocery.teddy.fyi/join/CDFH2345')).toBe('CDFH2345')
  })

  it('ignores a query string or fragment a link rewriter bolted on', () => {
    expect(inviteCodeFromPastedText('https://grocery.teddy.fyi/join/CDFH2345?utm=chat')).toBe(
      'CDFH2345'
    )
  })

  it('takes a bare code as the code', () => {
    expect(inviteCodeFromPastedText('cdfh2345')).toBe('CDFH2345')
  })

  it('stops at the code length, the way the box_s maxLength used to', () => {
    expect(inviteCodeFromPastedText('CDFH2345EXTRA')).toHaveLength(INVITE_CODE_LENGTH)
  })
})

describe('isCompleteInviteCode', () => {
  it('is true only at the length the server mints', () => {
    expect(isCompleteInviteCode('CDFH2345')).toBe(true)
    expect(isCompleteInviteCode('CDFH234')).toBe(false)
  })
})
