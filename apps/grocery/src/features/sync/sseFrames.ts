/**
 * The Server-Sent Events wire format, and what this app takes from it.
 *
 * Deliberately separate from the hook that opens the connection, so the format can be
 * tested without a socket. Every mistake available here fails the same silent way -- the
 * app simply stops updating, and the next ordinary sync covers it up -- so it is worth
 * having under test rather than under observation.
 *
 * Written to mirror `SseFrames.kt` and `SyncStreamEvent.kt` in `teddy-fyi-android`, in the
 * same shape and with the same names, so the two clients can be diffed against each other
 * the way the help copy already is.
 */

/** One decoded frame: whatever arrived between two blank lines. */
export interface SseFrame {
  id: string | null
  event: string | null
  data: string
}

/**
 * Turns a stream of lines into frames, one line at a time.
 *
 * Stateful and fed by the one reader draining the response body. Returns null for every
 * line that is still building a frame, and the finished frame on the blank line that ends
 * it -- which is what the spec means by dispatch.
 *
 * What each line shape does:
 *
 * - **`:` first** is a comment, and the server's keep-alive is one (`: ping`, every four
 *   minutes). Dropped entirely. Decoding it as an empty event would mean a sync every four
 *   minutes for the life of the stream -- the polling this replaces, by a longer road.
 * - **no colon** is a field with an empty value, and nothing read here means anything
 *   empty. Ignored.
 * - **one leading space after the colon** is stripped, and only one, per the spec.
 * - **several `data:` lines** join with a newline, in order.
 */
export class SseFrameReader {
  private id: string | null = null
  private event: string | null = null
  private data: string[] = []
  private sawAnyField = false

  accept(line: string): SseFrame | null {
    if (line === '') return this.dispatch()
    if (line.startsWith(':')) return null

    const colon = line.indexOf(':')
    if (colon < 0) return null

    const field = line.slice(0, colon)
    let value = line.slice(colon + 1)
    if (value.startsWith(' ')) value = value.slice(1)

    switch (field) {
      case 'id':
        this.id = value
        this.sawAnyField = true
        break
      case 'event':
        this.event = value
        this.sawAnyField = true
        break
      case 'data':
        this.data.push(value)
        this.sawAnyField = true
        break
      // `retry` and anything else: the reconnect delay here is this client's own jittered
      // backoff, which is about the whole fleet coming back after a deploy rather than
      // about one connection.
      default:
        break
    }
    return null
  }

  private dispatch(): SseFrame | null {
    if (!this.sawAnyField) return null
    const frame: SseFrame = { id: this.id, event: this.event, data: this.data.join('\n') }
    this.id = null
    this.event = null
    this.data = []
    this.sawAnyField = false
    return frame
  }
}

/**
 * What the server puts in a frame's `data:`.
 *
 * Read as loosely as possible on purpose. The server's own event type is internally tagged
 * and carries three variants, two of which only ever describe ScribbleRoute config and mean
 * nothing here -- so the tag is read as a plain string and anything unhandled is ignored,
 * which is what lets the server grow a fourth variant without this app failing to parse the
 * stream it is on.
 */
export interface SyncStreamEvent {
  type?: string
  entity?: string
  sender_client_id?: string
}

/** The six grocery tables, as `src/routes/sync/grocery/broadcast.rs` spells them. */
export const GROCERY_ENTITIES = new Set([
  'categories',
  'grocery_item_store_info',
  'grocery_items',
  'grocery_list_members',
  'grocery_lists',
  'stores',
])

/**
 * Whether a frame means a grocery table changed and a sync would find something.
 *
 * Matching the set of table names rather than a prefix is what keeps the config and todo
 * events that share this per-account channel from waking a grocery sync. Unparseable data
 * is not an error worth propagating: one bad frame must not end a stream that is otherwise
 * delivering.
 */
export function isGroceryInvalidation(data: string): boolean {
  let event: SyncStreamEvent
  try {
    event = JSON.parse(data) as SyncStreamEvent
  } catch {
    return false
  }
  if (!event || typeof event !== 'object') return false
  return event.type === 'INVALIDATE' && !!event.entity && GROCERY_ENTITIES.has(event.entity)
}
