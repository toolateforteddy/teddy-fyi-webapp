/**
 * Did the server refuse this session, or did we simply fail to ask it?
 *
 * This distinction is the whole reason the file exists. Both cases arrive as a
 * rejected promise from the same `/auth/refresh` call, and treating them alike is
 * how an offline launch used to sign a device out permanently: the catch deleted
 * the refresh token, the app fell to `/login`, and the only way back in -- Google
 * sign-in -- needs the network that was missing in the first place. For an app
 * that gets opened in a shop, that is the one failure it cannot afford.
 *
 * So the rule is deliberately narrow: only an actual HTTP answer saying "no" ends
 * a session. Everything else -- a dropped connection, a DNS failure, a timeout, a
 * 502 from the ingress, a bug in our own handler -- leaves the stored credentials
 * alone so the next launch with signal can try again.
 */
export function isSessionRejected(error: unknown): boolean {
  const status = (error as { response?: { status?: number } } | null | undefined)
    ?.response?.status

  // 401 is the refresh token being rejected. 403 is the account being refused
  // service (see the ban design in the API repo) -- also terminal, and also not
  // something a retry fixes.
  return status === 401 || status === 403
}
