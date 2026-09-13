import { describe, it, expect } from 'vitest'
import { SseFrameReader, isGroceryInvalidation } from '../sseFrames'
import { backoffFor, MIN_BACKOFF_MS, MAX_BACKOFF_MS } from '../hooks/useGroceryStream'

/**
 * The parts of the grocery stream that can be tested without a socket: the wire format,
 * what counts as a reason to sync, and the reconnect backoff. Every failure in here is
 * silent in the same way -- the page simply stops updating -- so none of it is something to
 * discover in a shop.
 */
describe('SseFrameReader', () => {
  const framesFrom = (wire: string) => {
    const reader = new SseFrameReader()
    return wire.split('\n').map(line => reader.accept(line)).filter(f => f !== null)
  }

  it('dispatches a frame on the blank line that ends it', () => {
    const frames = framesFrom('event: message\ndata: {"type":"INVALIDATE"}\n\n')
    expect(frames).toHaveLength(1)
    expect(frames[0]!.event).toBe('message')
    expect(frames[0]!.data).toBe('{"type":"INVALIDATE"}')
  })

  /**
   * The server's keep-alive is a comment every four minutes. Decoding one as an empty event
   * would mean a sync every four minutes for the life of the stream.
   */
  it('produces no frame for a keep-alive comment', () => {
    expect(framesFrom(':ping\n\n')).toHaveLength(0)
    expect(framesFrom(': ping\n\n')).toHaveLength(0)
    expect(framesFrom(':\n\n')).toHaveLength(0)
  })

  it('joins several data lines with a newline and strips only one leading space', () => {
    const frames = framesFrom('data: one\ndata:two\ndata:  three\n\n')
    expect(frames.map(f => f!.data)).toEqual(['one\ntwo\n three'])
  })

  it('keeps two frames in one read apart', () => {
    const frames = framesFrom('data: a\n\ndata: b\n\n')
    expect(frames.map(f => f!.data)).toEqual(['a', 'b'])
  })

  /** A line arriving in two reads is one line, which is what the caller's buffer is for. */
  it('treats a frame assembled across reads as one frame', () => {
    const reader = new SseFrameReader()
    expect(reader.accept('data: {"type":"INVALIDATE",')).toBeNull()
    expect(reader.accept('data: "entity":"grocery_items"}')).toBeNull()
    const frame = reader.accept('')
    expect(frame?.data).toBe('{"type":"INVALIDATE",\n"entity":"grocery_items"}')
  })

  it('dispatches nothing for a stray blank line', () => {
    expect(new SseFrameReader().accept('')).toBeNull()
  })
})

describe('isGroceryInvalidation', () => {
  /**
   * The payload the server actually sends. A field rename on either side of this is the
   * shape of bug that has bitten these two clients before, and nothing else here catches it.
   */
  it('recognises the payload the server sends', () => {
    expect(
      isGroceryInvalidation('{"type":"INVALIDATE","entity":"grocery_items","sender_client_id":"c1"}')
    ).toBe(true)
  })

  it('recognises every grocery table the server publishes', () => {
    const tables = [
      'categories',
      'grocery_item_store_info',
      'grocery_items',
      'grocery_list_members',
      'grocery_lists',
      'stores',
    ]
    for (const entity of tables) {
      expect(isGroceryInvalidation(`{"type":"INVALIDATE","entity":"${entity}"}`)).toBe(true)
    }
  })

  /**
   * The channel is per account, not per app: a tablet's config events and an entity this
   * client has never heard of both arrive here, and neither is a reason to sync groceries.
   */
  it('ignores everything that is not a grocery invalidation', () => {
    const notOurs = [
      '{"type":"DIRECT_UPDATE","entity":"config","key":"theme","value":"dark"}',
      '{"type":"INITIAL_STATE","entity":"config","data":[]}',
      '{"type":"INVALIDATE","entity":"todo_items"}',
      '{"type":"INVALIDATE"}',
      '{"type":"SOMETHING_NEW","entity":"grocery_items"}',
      'not json at all',
      '',
      'null',
    ]
    for (const payload of notOurs) {
      expect(isGroceryInvalidation(payload), payload).toBe(false)
    }
  })
})

describe('backoffFor', () => {
  it('never draws below the floor or above the ceiling', () => {
    for (let attempt = 0; attempt < 14; attempt += 1) {
      for (const draw of [0, 0.5, 1]) {
        const delay = backoffFor(attempt, () => draw)
        expect(delay).toBeGreaterThanOrEqual(MIN_BACKOFF_MS)
        expect(delay).toBeLessThanOrEqual(MAX_BACKOFF_MS)
      }
    }
  })

  /** Full jitter: the whole interval is reachable, not just the top of it. */
  it('draws from the whole interval', () => {
    expect(backoffFor(6, () => 0)).toBe(MIN_BACKOFF_MS)
    expect(backoffFor(6, () => 0.999)).toBeGreaterThan(MIN_BACKOFF_MS * 10)
  })

  it('stops growing at the ceiling', () => {
    expect(backoffFor(40, () => 1)).toBe(MAX_BACKOFF_MS)
  })
})
