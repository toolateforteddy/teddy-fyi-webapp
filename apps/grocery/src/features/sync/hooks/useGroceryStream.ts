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
 * @param onInvalidate run when a grocery change lands, already debounced, with why. Held in a
 *   ref, so the caller may pass a fresh closure on every render without reopening the
 *   connection.
 */
export function useGroceryStream(enabled: boolean, onInvalidate: (cause: StreamSyncCause) => void) {
  const onInvalidateRef = useRef(onInvalidate)
  onInvalidateRef.current = onInvalidate

  useEffect(() => {
    if (!enabled) return

    let stopped = false
    // The connection currently wanted, or null while the tab is hidden. Each connect gets its
    // own controller, so closing for a hide cannot be confused with a later reopen.
    let controller: AbortController | null = null
    let attempt = 0
    let connectedBefore = false
    // Set by a reopen after the tab was hidden, and spent by the connect that succeeds.
    let resuming = false
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined
    let debounceTimer: ReturnType<typeof setTimeout> | undefined
    let pendingCause: StreamSyncCause = 'invalidate'

    /**
     * One trip round a shop is a great many single-item syncs on somebody else's phone, and
     * each of ours is a request, a download and a reconcile. The window is short enough that
     * a change lands while you are still looking at the aisle it happened in.
     *
     * Causes folded into one sync keep the strongest of them: a `resume` sync may be dropped
     * as already covered (see StreamSyncCause), and an invalidation riding along with it must
     * not be dropped with it.
     */
    const scheduleSync = (cause: StreamSyncCause) => {
      if (debounceTimer !== undefined) {
        if (pendingCause === 'resume') pendingCause = cause
        return
      }
      pendingCause = cause
      debounceTimer = setTimeout(() => {
        debounceTimer = undefined
        if (stopped) return
        try {
          onInvalidateRef.current(pendingCause)
        } catch (err) {
          console.error('[Stream] Sync triggered by an invalidation failed:', err)
        }
      }, INVALIDATE_DEBOUNCE_MS)
    }

    const scheduleReconnect = () => {
      if (stopped || controller === null) return
      const delay = backoffFor(attempt)
      attempt += 1
      reconnectTimer = setTimeout(() => {
        reconnectTimer = undefined
        if (!stopped && controller !== null) void connect(controller)
      }, delay)
    }

    const connect = async (own: AbortController) => {
      if (stopped || own.signal.aborted) return
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
          signal: own.signal,
        })
        if (own.signal.aborted) return

        if (!response.ok || !response.body) {
          // A 401 is left to the next ordinary request: axios owns the refresh, and a
          // stream that refreshed on its own would race it for the rotating token. The
          // backoff carries on meanwhile, and the reconnect after the refresh succeeds.
          console.warn(`[Stream] Grocery stream refused: HTTP ${response.status}`)
          scheduleReconnect()
          return
        }

        attempt = 0
        // Anything that changed while the stream was down was published to nobody, so a
        // reconnect is answered with a sync as if an invalidation had arrived. Not the
        // first connect: the page has just synced on mount. A reopen after the tab was
        // hidden is a reconnect too -- the stream was closed on purpose, but the changes
        // published meanwhile went to nobody all the same.
        if (resuming) scheduleSync('resume')
        else if (connectedBefore) scheduleSync('reconnect')
        resuming = false
        connectedBefore = true
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        const frames = new SseFrameReader()
        // Bytes arrive in chunks that have nothing to do with line boundaries, so a line
        // can be split across two reads -- and a multi-byte character can be split across
        // two as well, which is what `stream: true` on the decoder is for.
        let buffer = ''

        for (;;) {
          const { done, value } = await reader.read()
          if (done || own.signal.aborted) break
          buffer += decoder.decode(value, { stream: true })

          let newline = buffer.indexOf('\n')
          while (newline >= 0) {
            const line = buffer.slice(0, newline).replace(/\r$/, '')
            buffer = buffer.slice(newline + 1)
            const frame = frames.accept(line)
            if (frame && isGroceryInvalidation(frame.data)) scheduleSync('invalidate')
            newline = buffer.indexOf('\n')
          }
        }

        // The server closed a stream that was working. Reconnecting is the point: it holds
        // itself open for as long as the page wants it.
        if (!own.signal.aborted) scheduleReconnect()
      } catch (err) {
        if (own.signal.aborted) return
        console.warn('[Stream] Grocery stream failed:', err)
        scheduleReconnect()
      }
    }

    const open = () => {
      controller = new AbortController()
      attempt = 0
      void connect(controller)
    }

    const close = () => {
      controller?.abort()
      controller = null
      if (reconnectTimer !== undefined) {
        clearTimeout(reconnectTimer)
        reconnectTimer = undefined
      }
    }

    /**
     * A hidden tab holds no stream. A phone in a pocket on the shopping page would otherwise
     * keep a server slot -- and a socket, and the radio -- for a list nobody is looking at, and
     * mobile browsers kill a backgrounded connection whenever they like anyway. Coming back
     * reopens it at once, with a fresh backoff, and the reopen syncs (see `resuming`).
     *
     * An invalidation already being debounced is left to run: it arrived while the stream
     * was open, and the sync it asks for is still owed.
     */
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        close()
      } else if (controller === null) {
        resuming = true
        open()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    if (document.visibilityState !== 'hidden') open()

    return () => {
      stopped = true
      document.removeEventListener('visibilitychange', onVisibilityChange)
      close()
      if (debounceTimer !== undefined) clearTimeout(debounceTimer)
    }
  }, [enabled])
}

/**
 * Why the stream is asking for a sync. Every cause is something the server has already said
 * or implied -- there is something to fetch -- so every one of them skips the status
 * pre-check.
 *
 * `resume` is kept apart because it is the one sync somebody else may already have run: the
 * app syncs on its own when a tab comes back after a while (GroceryContext's visibility
 * handler), so the reopen's sync is redundant when that one has already started since the
 * tab came back.
 */
export type StreamSyncCause = 'invalidate' | 'reconnect' | 'resume'

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
 * not wait this out: leaving the shopping page and coming back remounts the effect, and
 * hiding the tab and coming back reopens it, and either resets the attempt count and
 * reconnects at once.
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
