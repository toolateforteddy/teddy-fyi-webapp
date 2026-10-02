import { renderHook, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGroceryStream, INVALIDATE_DEBOUNCE_MS, MAX_BACKOFF_MS } from '../hooks/useGroceryStream'

/** A stream that stays open until `close` is called: the server ending one that was working. */
function openStream() {
  let close = () => {}
  const closed = new Promise<{ done: true; value: undefined }>(resolve => {
    close = () => resolve({ done: true, value: undefined })
  })
  const response = {
    ok: true,
    status: 200,
    body: { getReader: () => ({ read: () => closed }) },
  } as unknown as Response
  return { response, close }
}

describe('useGroceryStream', () => {
  let streams: ReturnType<typeof openStream>[] = []

  beforeEach(() => {
    vi.useFakeTimers()
    streams = []
    vi.stubGlobal('fetch', vi.fn(async () => {
      const stream = openStream()
      streams.push(stream)
      return stream.response
    }))
  })


  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('syncs after a reconnect, since nothing was published while the stream was down', async () => {
    const onInvalidate = vi.fn()
    const { unmount } = renderHook(() => useGroceryStream(true, onInvalidate))

    // First connect: the page synced on mount, so no extra sync.
    await act(async () => { await vi.advanceTimersByTimeAsync(INVALIDATE_DEBOUNCE_MS + 1) })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(onInvalidate).not.toHaveBeenCalled()

    // The server drops it; the reconnect is answered with one sync, debounced like an
    // invalidation.
    await act(async () => {
      streams[0].close()
      await vi.advanceTimersByTimeAsync(MAX_BACKOFF_MS)
    })
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(onInvalidate).toHaveBeenCalledTimes(1)

    unmount()
  })
})
