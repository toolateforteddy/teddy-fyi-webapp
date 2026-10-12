import api from '@/lib/axios'

/**
 * The invite this browser holds for the todo web app.
 *
 * The app is invite-only: the API refuses a sign-in from this origin unless the browser carries
 * a todo-web invite for the address signing in. The invite lives in an `HttpOnly` cookie the
 * API sets on its own host, so this page can neither read nor forge it — it can only ask the
 * API what it holds (`GET /auth/todo-web/invite`) and hand it a code to hold
 * (`POST /auth/todo-web/invite`). See `src/auth/todo_web.rs` in `teddy-fyi-api-rust`.
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

/** Asks the API which invite this browser holds. */
export async function fetchInviteState(): Promise<InviteState> {
  try {
    const response = await api.get<TodoInvite>('/auth/todo-web/invite')
    return { kind: 'invited', invite: response.data }
  } catch (error) {
    return statusOf(error) === 404 ? { kind: 'none' } : { kind: 'unknown' }
  }
}

/** Why the API would not hold a code. */
export type AdmitFailure = 'refused' | 'unreachable'

/**
 * Hands the API a code from an invite link to hold in this browser's cookie.
 *
 * `refused` is a `403`: expired, tampered with, or an ordinary account invite rather than a
 * todo-web one. The API does not say which, for the reason `/auth/login` does not.
 */
export async function admitInvite(
  code: string,
): Promise<{ ok: true; invite: TodoInvite } | { ok: false; reason: AdmitFailure }> {
  try {
    const response = await api.post<TodoInvite>('/auth/todo-web/invite', { code })
    return { ok: true, invite: response.data }
  } catch (error) {
    return { ok: false, reason: statusOf(error) === 403 ? 'refused' : 'unreachable' }
  }
}
