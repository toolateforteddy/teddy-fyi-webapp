import { useEffect, useRef } from 'react'
import { env } from '@/config/env'
import { getClientUuid } from '@/utils/uuid'
import { SseFrameReader, isGroceryInvalidation } from '@/features/sync/sseFrames'

/**
 * Holds the real-time sync stream open and runs a sync whenever the server says a grocery
 * table changed.
 *
 * Shopping is the one screen where somebody else's change matters within seconds: two
 * people in one shop, one crossing things off and the other adding them. This app has never
 * polled -- it syncs when it has something of its own to push, and when the network comes
 * back -- so until this existed, sitting on the shopping page, a co-shopper's additions
 * simply never arrived.
 *
 * `GET /api/sync/stream?scope=grocery` is a per-account Server-Sent Events feed the server
 * publishes a small `INVALIDATE` on whenever a grocery table changes for an account that
 * can see it. Each one is answered with the ordinary sync, which is what actually moves the
 * rows; the event only says there is something to fetch.
 *
 * **It is an accelerant and never the only path.** Every sync that happened before this
 * existed still happens: the debounced push after a local edit, the `online` handler, the
 * first sync on mount. A stream that is refused, unreachable, or open against a server that
 * is not publishing yet leaves this page exactly as it was, which is what makes it safe to
 * ship ahead of the server half.
 *
 * @param enabled whether the stream should be open right now. The caller holds this true
 *   for the shopping page with a store selected and false everywhere else; a stream costs
 *   the server a slot per account, and this is the only screen where a stale list is wrong
 *   in a way anyone notices.
 * @param onInvalidate run when a grocery change lands, already debounced. Held in a ref, so
 *   the caller may pass a fresh closure on every render without reopening the connection.
 */
export function useGroceryStream(enabled: boolean, onInvalidate: () => void) {
  const onInvalidateRef = useRef(onInvalidate)
  onInvalidateRef.current = onInvalidate

  useEffect(() => {
    if (!enabled) return

    const controller = new AbortController()
    let stopped = false
    let attempt = 0
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined
    let debounceTimer: ReturnType<typeof setTimeout> | undefined

    /**
     * One trip round a shop is a great many single-item syncs on somebody else's phone, and
     * each of ours is a request, a download and a reconcile. The window is short enough that
     * a change lands while you are still looking at the aisle it happened in.
     */
    const scheduleSync = () => {
      if (debounceTimer !== undefined) return
      debounceTimer = setTimeout(() => {
        debounceTimer = undefined
        if (stopped) return
        try {
          onInvalidateRef.current()
        } catch (err) {
          console.error('[Stream] Sync triggered by an invalidation failed:', err)
        }
      }, INVALIDATE_DEBOUNCE_MS)
    }

    const scheduleReconnect = () => {
      if (stopped) return
      const delay = backoffFor(attempt)
      attempt += 1
      reconnectTimer = setTimeout(() => {
        reconnectTimer = undefined
        if (!stopped) void connect()
      }, delay)
    }

    const connect = async () => {
      if (stopped) return
      try {
        // `fetch` rather than `EventSource`, which cannot be given headers -- and
        // `/api/sync/stream` answers 400 without `X-Client-UUID`. `credentials: 'include'`
        // carries the session cookie the rest of the app authenticates with, the same thing
        // the axios instance does with `withCredentials`.
        const response = await fetch(`${env.isDev ? '' : env.API_BASE_URL}${STREAM_PATH}`, {
          headers: {
            Accept: 'text/event-stream',
            'X-Client-UUID': getClientUuid(),
          },
          credentials: 'include',
          signal: controller.signal,
        })

        if (!response.ok || !response.body) {
          // A 401 is left to the next ordinary request: axios owns the refresh, and a
          // stream that refreshed on its own would race it for the rotating token. The
          // backoff carries on meanwhile, and the reconnect after the refresh succeeds.
          console.warn(`[Stream] Grocery stream refused: HTTP ${response.status}`)
          scheduleReconnect()
          return
        }

        attempt = 0
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        const frames = new SseFrameReader()
        // Bytes arrive in chunks that have nothing to do with line boundaries, so a line
        // can be split across two reads -- and a multi-byte character can be split across
        // two as well, which is what `stream: true` on the decoder is for.
        let buffer = ''

        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          let newline = buffer.indexOf('\n')
          while (newline >= 0) {
            const line = buffer.slice(0, newline).replace(/\r$/, '')
            buffer = buffer.slice(newline + 1)
            const frame = frames.accept(line)
            if (frame && isGroceryInvalidation(frame.data)) scheduleSync()
            newline = buffer.indexOf('\n')
          }
        }

        // The server closed a stream that was working. Reconnecting is the point: it holds
        // itself open for as long as the page wants it.
        scheduleReconnect()
      } catch (err) {
        if (controller.signal.aborted) return
        console.warn('[Stream] Grocery stream failed:', err)
        scheduleReconnect()
      }
    }

    void connect()

    return () => {
      stopped = true
      controller.abort()
      if (reconnectTimer !== undefined) clearTimeout(reconnectTimer)
      if (debounceTimer !== undefined) clearTimeout(debounceTimer)
    }
  }, [enabled])
}

/**
 * `scope=grocery` is load-bearing rather than decoration. Without it the server treats the
 * stream as one of the ScribbleRoute tablets': it resolves the account's fallback device,
 * subscribes a second channel for it, and opens with a snapshot of a config table this app
 * does not have.
 */
const STREAM_PATH = '/api/sync/stream?scope=grocery'

/** How long a burst of invalidations is gathered up for before one sync runs. */
export const INVALIDATE_DEBOUNCE_MS = 1_000

export const INITIAL_BACKOFF_MS = 1_000
export const MIN_BACKOFF_MS = 250

/**
 * The longest the computed backoff may grow to. A stream that has been failing for five
 * minutes is not one more reconnect away from working. Somebody actually waiting on it does
 * not wait this out: leaving the shopping page and coming back remounts the effect, which
 * resets the attempt count and reconnects at once.
 */
export const MAX_BACKOFF_MS = 300_000

const MAX_SHIFT = 10

/**
 * How long to wait before reconnect number `attempt`.
 *
 * Full jitter -- a draw from the whole interval between nothing and the ceiling, rather than
 * the ceiling with a nudge on it. The point is every device at once, not this one: when a
 * deploy drops every stream, a backoff that is a function of the attempt number alone brings
 * them all back at the same instant, again at the same instant, so the server meets its
 * whole fleet in one spike each time. Jitter around a common centre only narrows the spike.
 *
 * The floor matters for the opposite case: full jitter is allowed to draw nearly zero, and a
 * run of those against a server refusing instantly is a tight loop.
 */
export function backoffFor(attempt: number, random: () => number = Math.random): number {
  const shift = Math.min(Math.max(attempt, 0), MAX_SHIFT)
  const ceiling = Math.min(MAX_BACKOFF_MS, INITIAL_BACKOFF_MS * 2 ** shift)
  // Clamped at both ends rather than only at the floor. `Math.random` is documented as
  // [0, 1), so `random() * (ceiling + 1)` is below the ceiling in practice -- but "in
  // practice" is doing the work there, and an injected source in a test, or a future one
  // that closes the interval, walks straight past the ceiling this function exists to
  // impose. Clamping says what is meant.
  const drawn = Math.floor(random() * (ceiling + 1))
  return Math.min(ceiling, Math.max(MIN_BACKOFF_MS, drawn))
}
