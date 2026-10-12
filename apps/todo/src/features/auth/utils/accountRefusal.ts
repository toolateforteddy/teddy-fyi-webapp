/**
 * Did the server decline to *create* an account, as opposed to declining the token?
 *
 * `/auth/login` answers `403` for one thing only: Google vouched for the token, and there is
 * still no account for that person — this client may not bring one into existence, and none
 * exists yet. A rejected or expired token is a `401`, and everything else is a failure to ask.
 *
 * The distinction earns its own file for the reason [isSessionRejected] does: all three arrive
 * as the same rejected promise from the same call, and flattening them leaves the login screen
 * saying "Authentication exchange failed" to somebody whose authentication did not fail. It is
 * also the only one of the three with a remedy a person can act on — an invite code — and a
 * screen cannot offer a remedy it cannot detect.
 *
 * The server makes the status distinguishable deliberately; see `ensure_account` in
 * `teddy-fyi-api-rust`, and `context/2026-09-11_account_invites.md` for the invite itself.
 */
export function isAccountRefused(error: unknown): boolean {
  const status = (error as { response?: { status?: number } } | null | undefined)
    ?.response?.status

  return status === 403
}
