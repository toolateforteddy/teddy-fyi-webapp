import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { registerServiceWorker, subscribeToUpdates, applyUpdate, resetUpdateStateForTests } from '../pwa'

/**
 * A fake worker registration, built to be driven: `fireUpdateFound` walks a new
 * worker through the same install -> installed transition a real one does, which is
 * the sequence every case here turns on.
 */
function makeRegistration() {
  const regListeners: Record<string, (() => void)[]> = {}
  let installing: FakeWorker | null = null

  interface FakeWorker {
    state: string
    postMessage: ReturnType<typeof vi.fn>
    addEventListener: (type: string, cb: () => void) => void
    _fire: (type: string) => void
  }

  function makeWorker(): FakeWorker {
    const workerListeners: Record<string, (() => void)[]> = {}
    return {
      state: 'installing',
      postMessage: vi.fn(),
      addEventListener: (type, cb) => {
        (workerListeners[type] ||= []).push(cb)
      },
      _fire: type => (workerListeners[type] || []).forEach(cb => cb()),
    }
  }

  const registration = {
    waiting: null as FakeWorker | null,
    get installing() {
      return installing
    },
    update: vi.fn().mockResolvedValue(undefined),
    addEventListener: (type: string, cb: () => void) => {
      (regListeners[type] ||= []).push(cb)
    },
  }

  return {
    registration,
    /** A new worker appears, installs, and lands in `installed`. */
    fireUpdateFound() {
      installing = makeWorker()
      ;(regListeners['updatefound'] || []).forEach(cb => cb())
      installing.state = 'installed'
      installing._fire('statechange')
      return installing
    },
    setWaiting() {
      registration.waiting = makeWorker()
      registration.waiting.state = 'installed'
      return registration.waiting
    },
  }
}

let harness: ReturnType<typeof makeRegistration>
const swListeners: Record<string, (() => void)[]> = {}
const reload = vi.fn()

function installMocks({ controlled }: { controlled: boolean }) {
  harness = makeRegistration()
  for (const key of Object.keys(swListeners)) delete swListeners[key]

  Object.defineProperty(window.navigator, 'serviceWorker', {
    value: {
      register: vi.fn().mockResolvedValue(harness.registration),
      getRegistrations: vi.fn().mockResolvedValue([]),
      // The load-bearing one: a controller means this page is already running a
      // worker, so a newly installed one is an update rather than a first install.
      controller: controlled ? {} : null,
      addEventListener: (type: string, cb: () => void) => {
        (swListeners[type] ||= []).push(cb)
      },
    },
    configurable: true,
    writable: true,
  })
  Object.defineProperty(window, 'caches', {
    value: { keys: vi.fn().mockResolvedValue([]), delete: vi.fn().mockResolvedValue(true) },
    configurable: true,
    writable: true,
  })
  Object.defineProperty(window, 'location', {
    value: { ...window.location, reload, search: '', pathname: '/', href: 'http://localhost/' },
    configurable: true,
    writable: true,
  })
}

const fireControllerChange = () => (swListeners['controllerchange'] || []).forEach(cb => cb())

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  resetUpdateStateForTests()
  installMocks({ controlled: true })
  window.history.replaceState(null, '', '/')
})

afterEach(() => {
  vi.useRealTimers()
})

describe('update detection', () => {
  it('announces a new version once a second worker finishes installing', async () => {
    await registerServiceWorker()
    const seen: boolean[] = []
    subscribeToUpdates(ready => seen.push(ready))

    harness.fireUpdateFound()

    expect(seen).toEqual([false, true])
  })

  // The case that makes a naive implementation announce an update to someone who
  // has only just arrived: the very first worker also passes through `installed`.
  it('stays quiet for a first install, when nothing controls the page yet', async () => {
    installMocks({ controlled: false })
    await registerServiceWorker()
    const seen: boolean[] = []
    subscribeToUpdates(ready => seen.push(ready))

    harness.fireUpdateFound()

    expect(seen).toEqual([false])
  })

  it('announces a worker that was already waiting from a previous visit', async () => {
    harness = makeRegistration()
    const pending = harness.setWaiting()
    Object.defineProperty(window.navigator, 'serviceWorker', {
      value: {
        register: vi.fn().mockResolvedValue(harness.registration),
        getRegistrations: vi.fn().mockResolvedValue([]),
        controller: {},
        addEventListener: (type: string, cb: () => void) => {
          (swListeners[type] ||= []).push(cb)
        },
      },
      configurable: true,
      writable: true,
    })

    await registerServiceWorker()
    const seen: boolean[] = []
    subscribeToUpdates(ready => seen.push(ready))

    expect(seen).toEqual([true])
    applyUpdate()
    expect(pending.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
  })

  it('tells a late subscriber about an update it already found', async () => {
    await registerServiceWorker()
    harness.fireUpdateFound()

    const seen: boolean[] = []
    subscribeToUpdates(ready => seen.push(ready))

    expect(seen).toEqual([true])
  })

  it('stops calling a listener once it unsubscribes', async () => {
    await registerServiceWorker()
    const listener = vi.fn()
    const unsubscribe = subscribeToUpdates(listener)
    listener.mockClear()

    unsubscribe()
    harness.fireUpdateFound()

    expect(listener).not.toHaveBeenCalled()
  })
})

describe('applying an update', () => {
  it('asks the waiting worker to skip waiting', async () => {
    await registerServiceWorker()
    const pending = harness.fireUpdateFound()

    applyUpdate()

    expect(pending.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
  })

  // Reloading before the new worker controls the page just re-serves the old bundle
  // from the old worker, so the reload waits for controllerchange.
  it('does not reload until the new worker is in control', async () => {
    await registerServiceWorker()
    harness.fireUpdateFound()

    applyUpdate()
    expect(reload).not.toHaveBeenCalled()

    fireControllerChange()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('reloads once however many times control changes', async () => {
    await registerServiceWorker()
    harness.fireUpdateFound()

    applyUpdate()
    fireControllerChange()
    fireControllerChange()

    expect(reload).toHaveBeenCalledTimes(1)
  })

  // A worker can take control for reasons we did not ask for -- notably the
  // self-destroying build of the kill switch. Reloading then would be a surprise.
  it('does not reload on a control change nobody asked for', async () => {
    await registerServiceWorker()
    harness.fireUpdateFound()

    fireControllerChange()

    expect(reload).not.toHaveBeenCalled()
  })

  it('does nothing when there is no waiting worker', async () => {
    await registerServiceWorker()

    applyUpdate()
    fireControllerChange()

    expect(reload).not.toHaveBeenCalled()
  })

  it('ignores a second apply while the first is in flight', async () => {
    await registerServiceWorker()
    const pending = harness.fireUpdateFound()

    applyUpdate()
    applyUpdate()

    expect(pending.postMessage).toHaveBeenCalledTimes(1)
  })
})

describe('checking for updates', () => {
  it('polls hourly', async () => {
    await registerServiceWorker()
    harness.registration.update.mockClear()

    vi.advanceTimersByTime(60 * 60 * 1000)
    expect(harness.registration.update).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(60 * 60 * 1000)
    expect(harness.registration.update).toHaveBeenCalledTimes(2)
  })

  it('checks when the app comes back to the foreground', async () => {
    await registerServiceWorker()
    harness.registration.update.mockClear()

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    expect(harness.registration.update).toHaveBeenCalledTimes(1)
  })

  it('does not check when the app is backgrounded', async () => {
    await registerServiceWorker()
    harness.registration.update.mockClear()

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    expect(harness.registration.update).not.toHaveBeenCalled()
  })

  it('survives a check that fails because the device is offline', async () => {
    await registerServiceWorker()
    harness.registration.update.mockRejectedValue(new Error('Failed to fetch'))

    expect(() => vi.advanceTimersByTime(60 * 60 * 1000)).not.toThrow()
  })
})
