import api from '@/lib/axios'

/**
 * The invite this browser holds for the todo web app.
 *
 * The app is invite-only: the API refuses a sign-in from this origin unless the browser carries
 * a todo-web invite for the address signing in. The invite lives in an `HttpOnly` cookie the
 * API sets on its own host, so this page can neither read nor forge it — it can only ask the
 * API what it holds (`GET /auth/todo-web/status`) and hand it a code to hold
 * (`POST /auth/todo-web/redeem`). The contract is `todo-web/invite-api.md` in the project's
 * shared files, implemented in `teddy-fyi-api-rust`.
 *
 * A cookie rather than localStorage for the reason that matters most here: an app installed
 * from this browser shares its cookie jar, so somebody who opened the link in their work
 * profile's Chrome and installed from there is still invited inside the installed app.
 */
export interface TodoInvite {
  /** The address the invite admits, already normalised by the server. */
  email: string
  /** RFC 3339. */
  expires_at: string
}

/**
 * What the sign-in screen knows about the invite.
 *
 * `unknown` is its own answer rather than being folded into `none`: a phone with no signal
 * cannot ask, and telling somebody who *is* invited that they are not is the worse mistake.
 */
export type InviteState =
  | { kind: 'invited'; invite: TodoInvite }
  | { kind: 'none' }
  | { kind: 'unknown' }

/** Codes are signed JWTs: three base64url segments. Checked so a cut-off link says so. */
const INVITE_CODE_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/

/**
 * The code a `/invite/:code` route param carries, or null if there is not a whole one.
 *
 * A stray `%` from a hand-edited link is enough to make `decodeURIComponent` throw, so a
 * failed decode falls back to the raw segment rather than to nothing.
 */
export function inviteCodeFromRouteParam(param: string | undefined): string | null {
  if (!param) return null
  let decoded: string
  try {
    decoded = decodeURIComponent(param)
  } catch {
    decoded = param
  }
  const code = decoded.trim()
  return INVITE_CODE_SHAPE.test(code) ? code : null
}

function statusOf(error: unknown): number | undefined {
  return (error as { response?: { status?: number } } | null | undefined)?.response?.status
}

type StatusResponse = { invited: true; email: string; expires_at: string } | { invited: false }

/** Asks the API which invite this browser holds. It answers 200 either way. */
export async function fetchInviteState(): Promise<InviteState> {
  try {
    const { data } = await api.get<StatusResponse>('/auth/todo-web/status')
    return data.invited ? { kind: 'invited', invite: { email: data.email, expires_at: data.expires_at } } : { kind: 'none' }
  } catch {
    return { kind: 'unknown' }
  }
}

/** Why the API would not hold a code. */
export type AdmitFailure = 'refused' | 'unreachable'

/**
 * Hands the API a code from an invite link to hold in this browser's cookie.
 *
 * `refused` is the API's `400 invalid_invite`: malformed, forged or expired. It does not say
 * which.
 */
export async function admitInvite(
  code: string,
): Promise<{ ok: true; invite: TodoInvite } | { ok: false; reason: AdmitFailure }> {
  try {
    const response = await api.post<TodoInvite>('/auth/todo-web/redeem', { code })
    return { ok: true, invite: response.data }
  } catch (error) {
    return { ok: false, reason: statusOf(error) === 400 ? 'refused' : 'unreachable' }
  }
}

/** Why `/auth/login` refused a sign-in from this origin, if it was the invite gate. */
export type LoginRefusal = 'invite_required' | 'email_mismatch'

export function loginRefusalOf(error: unknown): LoginRefusal | null {
  const response = (error as { response?: { status?: number; data?: { error?: unknown } } } | null | undefined)?.response
  if (response?.status !== 403) return null
  if (response.data?.error === 'todo_web_invite_required') return 'invite_required'
  if (response.data?.error === 'todo_web_invite_email_mismatch') return 'email_mismatch'
  return null
}
