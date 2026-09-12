/**
 * The invite code as a link, and a link back to an invite code.
 *
 * Sharing a list used to end at eight characters on a screen: the sender read them out or
 * copied them into a message, and the recipient found the Join List box and typed them in.
 * Every one of those steps is a place to give up, and the two that involve transcription are
 * places to get it wrong. `/join/<code>` collapses all of it into a tap — the recipient lands
 * on a page that signs them in and joins them.
 *
 * The link is a *transport for the code*, not a second credential. Whatever is at the end of
 * the URL is exactly what `POST /api/lists/join` has always taken, which is why the code is
 * still shown next to the link: somebody on a locked-down tablet, or somebody you are reading
 * it to over the phone, can still use it.
 */

/** Characters in an invite code. The server mints exactly this many. */
export const INVITE_CODE_LENGTH = 8

/** The public route that redeems a code. */
export const JOIN_ROUTE_PREFIX = '/join'

/**
 * A code folded to the form the server stores and compares: non-alphanumerics dropped, the
 * rest uppercased. Mirrors `normalize_code` in `src/routes/lists/handlers.rs`, which is what
 * lets a code survive being pasted with a stray space, a dash, or the rest of a URL around it.
 */
export function normalizeInviteCode(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
}

/** Whether a normalized code is the right shape to be worth sending to the server. */
export function isCompleteInviteCode(code: string): boolean {
  return code.length === INVITE_CODE_LENGTH
}

/**
 * The link for a code, on this origin.
 *
 * Deliberately `window.location.origin` rather than the `url` the API now returns alongside
 * the code. The join page is a route in *this* bundle, so this app is the one thing that
 * cannot be wrong about where it lives — and taking the server's answer would hand out
 * production links from a dev server, which is the one environment where somebody is
 * actually clicking them to see whether they work. The API's `url` exists for the Android
 * app, which has no origin of its own and ships on its own release cycle.
 */
export function inviteLinkFor(code: string): string {
  return `${window.location.origin}${JOIN_ROUTE_PREFIX}/${normalizeInviteCode(code)}`
}

/**
 * The code carried by whatever the join route was handed, or null if there is not one.
 *
 * Takes the raw path segment rather than a whole URL: React Router has already split it off,
 * and a segment is all a share sheet, a messaging app's link rewriter or a copy-paste can
 * mangle. Anything that does not normalize to a full-length code is rejected here rather than
 * spent against the server's five-failures-per-ten-minutes allowance.
 */
export function inviteCodeFromRouteParam(param: string | undefined): string | null {
  if (!param) return null

  // A lone `%` is enough to make decodeURIComponent throw, and a URL somebody has edited by
  // hand is exactly where that comes from. The raw segment is still worth normalizing: an
  // invite code has nothing in it that needs escaping in the first place.
  let decoded: string
  try {
    decoded = decodeURIComponent(param)
  } catch {
    decoded = param
  }

  const code = normalizeInviteCode(decoded)
  return isCompleteInviteCode(code) ? code : null
}

/**
 * The code inside whatever somebody put in the Join List box.
 *
 * A person handed a link and told to "join the list" will paste the link, because that is
 * what they were given -- so the box takes one. Anything else is treated as the code itself
 * and folded the way the server folds it. The result is capped at the code's length, which
 * is what the box's `maxLength` used to do before it had to accept something longer than a
 * code in the first place.
 */
export function inviteCodeFromPastedText(raw: string): string {
  const fromLink = raw.match(/\/join\/([^/?#\s]+)/i)
  return normalizeInviteCode(fromLink ? fromLink[1] : raw).slice(0, INVITE_CODE_LENGTH)
}
