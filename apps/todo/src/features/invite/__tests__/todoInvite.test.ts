import { describe, expect, it, vi, beforeEach } from 'vitest'
import api from '@/lib/axios'
import { admitInvite, fetchInviteState, inviteCodeFromRouteParam, loginRefusalOf } from '../todoInvite'

vi.mock('@/lib/axios', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}))

const code = 'eyJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6Im11bUBleGFtcGxlLmNvbSJ9.c2ln-bmF0dXJl_x'

describe('inviteCodeFromRouteParam', () => {
  it('returns a whole code, trimmed and decoded', () => {
    expect(inviteCodeFromRouteParam(code)).toBe(code)
    expect(inviteCodeFromRouteParam(encodeURIComponent(` ${code} `))).toBe(code)
  })

  it('refuses a missing or cut-off code', () => {
    expect(inviteCodeFromRouteParam(undefined)).toBeNull()
    expect(inviteCodeFromRouteParam('')).toBeNull()
    expect(inviteCodeFromRouteParam(code.split('.').slice(0, 2).join('.'))).toBeNull()
  })

  it('survives a stray percent sign', () => {
    expect(inviteCodeFromRouteParam('abc%')).toBeNull()
  })
})

describe('fetchInviteState', () => {
  beforeEach(() => vi.mocked(api.get).mockReset())

  it('reports the held invite', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { invited: true, email: 'mum@example.com', expires_at: '2026-11-01T00:00:00Z' } })
    await expect(fetchInviteState()).resolves.toEqual({
      kind: 'invited',
      invite: { email: 'mum@example.com', expires_at: '2026-11-01T00:00:00Z' },
    })
  })

  it('invited: false means no invite, a failure means it could not tell', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { invited: false } })
    await expect(fetchInviteState()).resolves.toEqual({ kind: 'none' })
    vi.mocked(api.get).mockRejectedValueOnce(new Error('Network Error'))
    await expect(fetchInviteState()).resolves.toEqual({ kind: 'unknown' })
  })
})

describe('admitInvite', () => {
  beforeEach(() => vi.mocked(api.post).mockReset())

  it('posts the code and returns the invite', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { email: 'mum@example.com', expires_at: 'x' } })
    await expect(admitInvite(code)).resolves.toEqual({ ok: true, invite: { email: 'mum@example.com', expires_at: 'x' } })
    expect(api.post).toHaveBeenCalledWith('/auth/todo-web/redeem', { code })
  })

  it('tells a refusal from an unreachable server', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({ response: { status: 400, data: { error: 'invalid_invite' } } })
    await expect(admitInvite(code)).resolves.toEqual({ ok: false, reason: 'refused' })
    vi.mocked(api.post).mockRejectedValueOnce(new Error('timeout'))
    await expect(admitInvite(code)).resolves.toEqual({ ok: false, reason: 'unreachable' })
  })
})

describe('loginRefusalOf', () => {
  it('reads the two invite-gate refusals', () => {
    expect(loginRefusalOf({ response: { status: 403, data: { error: 'todo_web_invite_required' } } })).toBe('invite_required')
    expect(loginRefusalOf({ response: { status: 403, data: { error: 'todo_web_invite_email_mismatch' } } })).toBe('email_mismatch')
  })

  it('leaves every other failure alone', () => {
    expect(loginRefusalOf({ response: { status: 403, data: { error: 'something_else' } } })).toBeNull()
    expect(loginRefusalOf({ response: { status: 500 } })).toBeNull()
    expect(loginRefusalOf(new Error('Network Error'))).toBeNull()
  })
})
