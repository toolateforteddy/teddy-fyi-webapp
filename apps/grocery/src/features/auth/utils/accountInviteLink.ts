/**
 * An account invite as a link, and a link back to an invite code.
 *
 * Distinct from `features/grocery/utils/inviteLink`, which is the *list* invite: that one
 * adds somebody to a grocery list they can only reach once they have an account, this one is
 * how the account comes into existence at all. They share a shape and nothing else — a list
 * code is eight characters the server stores and spends, an account invite is a signed JWT
 * naming one email address that the server keeps no record of.
 *
 * The link is a *transport for the code*, not a second credential. What sits at the end of
 * `/invite/<code>` is exactly what `invite_code` on `POST /auth/login` has always taken,
 * which is why the minting screens still show the code beside the link: somebody being read
 * it down the phone can still use it.
 */

/** The public route that redeems an account invite. */
export const INVITE_ROUTE_PREFIX = '/invite'

/**
 * Whether a string is shaped like the credential the server mints.
 *
 * An account invite is an HS256 JWT, so it is three base64url segments separated by dots and
 * nothing else. Checked rather than merely trimmed for the reason the list-invite route checks
 * a code's length: the common failure is a *truncated* link — a messaging app that wrapped the
 * URL, a mail client that hyperlinked half of it — and a page that can tell says "this link is
 * incomplete" instead of putting the recipient through a Google sign-in to reach a refusal
 * that cannot explain itself.
 *
 * Deliberately not a decode. Nothing here reads the claims: the address the invite names is
 * checked against the *verified* email on the ID token, server-side, and a client that looked
 * would only be able to display a value it cannot trust.
 */
const INVITE_CODE_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/

export function isInviteCodeShaped(raw: string): boolean {
  return INVITE_CODE_SHAPE.test(raw)
}

/**
 * The code carried by whatever the invite route was handed, or null if there is not a whole
 * one.
 *
 * Takes the raw path segment rather than a whole URL: React Router has already split it off.
 * A JWT is base64url and dots throughout, so nothing in it ever needed escaping — but a link
 * somebody has edited by hand is exactly where a stray `%` comes from, and one is enough to
 * make `decodeURIComponent` throw.
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
  return isInviteCodeShaped(code) ? code : null
}
