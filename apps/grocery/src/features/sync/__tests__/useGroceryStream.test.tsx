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
    expect(onInvalidate).toHaveBeenCalledWith('reconnect')

    unmount()
  })

  describe('while the tab is hidden', () => {
    let visibility: DocumentVisibilityState = 'visible'

    const setVisibility = (state: DocumentVisibilityState) => {
      visibility = state
      document.dispatchEvent(new Event('visibilitychange'))
    }

    const signalOf = (call: number) => (vi.mocked(fetch).mock.calls[call][1] as RequestInit).signal as AbortSignal

    beforeEach(() => {
      visibility = 'visible'
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility })
    })

    afterEach(() => {
      // Back to jsdom's own getter on the prototype.
      delete (document as { visibilityState?: DocumentVisibilityState }).visibilityState
    })

    it('closes the stream, and reopens it with a sync when the tab comes back', async () => {
      const onInvalidate = vi.fn()
      const { unmount } = renderHook(() => useGroceryStream(true, onInvalidate))
      await act(async () => { await vi.advanceTimersByTimeAsync(INVALIDATE_DEBOUNCE_MS + 1) })
      expect(fetch).toHaveBeenCalledTimes(1)

      await act(async () => { setVisibility('hidden') })
      expect(signalOf(0).aborted).toBe(true)

      // Nothing reconnects behind the user's back while hidden.
      await act(async () => { await vi.advanceTimersByTimeAsync(MAX_BACKOFF_MS * 2) })
      expect(fetch).toHaveBeenCalledTimes(1)
      expect(onInvalidate).not.toHaveBeenCalled()

      // Back at once rather than after a backoff, and the gap is caught up with one sync.
      await act(async () => { setVisibility('visible') })
      expect(fetch).toHaveBeenCalledTimes(2)
      expect(signalOf(1).aborted).toBe(false)
      await act(async () => { await vi.advanceTimersByTimeAsync(INVALIDATE_DEBOUNCE_MS + 1) })
      expect(onInvalidate).toHaveBeenCalledTimes(1)
      expect(onInvalidate).toHaveBeenCalledWith('resume')

      unmount()
    })

    it('stops a pending reconnect when the tab is hidden', async () => {
      const onInvalidate = vi.fn()
      const { unmount } = renderHook(() => useGroceryStream(true, onInvalidate))
      await act(async () => { await vi.advanceTimersByTimeAsync(0) })

      // The server drops the stream, and the tab is hidden before the backoff runs out.
      await act(async () => {
        streams[0].close()
        await vi.advanceTimersByTimeAsync(0)
        setVisibility('hidden')
        await vi.advanceTimersByTimeAsync(MAX_BACKOFF_MS * 2)
      })
      expect(fetch).toHaveBeenCalledTimes(1)
      expect(onInvalidate).not.toHaveBeenCalled()

      unmount()
    })

    it('does not open at all until a tab mounted hidden is shown', async () => {
      visibility = 'hidden'
      const onInvalidate = vi.fn()
      const { unmount } = renderHook(() => useGroceryStream(true, onInvalidate))
      await act(async () => { await vi.advanceTimersByTimeAsync(MAX_BACKOFF_MS) })
      expect(fetch).not.toHaveBeenCalled()

      await act(async () => { setVisibility('visible') })
      expect(fetch).toHaveBeenCalledTimes(1)

      unmount()
    })
  })
})
