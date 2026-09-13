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

/**
 * Put the document in or out of view. `visibilityState` is a getter on the real
 * document, so it has to be redefined rather than assigned -- and it has to be put
 * back in `beforeEach`, or one backgrounded case leaves every case after it hidden.
 */
function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  resetUpdateStateForTests()
  installMocks({ controlled: true })
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
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

  // Another tab pressed Reload. This one is on screen, so it is told rather than
  // yanked -- the banner is already up and its button is what reloads it.
  it('does not reload a visible page when another tab applies the update', async () => {
    await registerServiceWorker()
    harness.fireUpdateFound()

    fireControllerChange()

    expect(reload).not.toHaveBeenCalled()
  })

  // A worker can take control with no update of ours in play -- notably the
  // self-destroying build of the kill switch, which claims clients and navigates them
  // itself. Not ours to react to.
  it('does not reload on a control change with no update tracked', async () => {
    await registerServiceWorker()

    setVisibility('hidden')
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

  // The reload is driven by controllerchange, and a worker that never answers used to
  // leave the button saying "Reloading..." until the window was closed -- which is the
  // very thing this is all trying to stop being the fix.
  it('reloads anyway when the worker never takes control', async () => {
    await registerServiceWorker()
    harness.fireUpdateFound()

    applyUpdate()
    expect(reload).not.toHaveBeenCalled()

    vi.advanceTimersByTime(5 * 1000)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  // The second-tab case. Another window activated this version, so the worker we were
  // tracking is the active one now and SKIP_WAITING to it does nothing at all. All
  // that is left is to reload onto the bundle already being served.
  it('reloads straight away once another tab has activated the update', async () => {
    await registerServiceWorker()
    const pending = harness.fireUpdateFound()

    fireControllerChange()
    expect(reload).not.toHaveBeenCalled()

    applyUpdate()

    expect(reload).toHaveBeenCalledTimes(1)
    expect(pending.postMessage).not.toHaveBeenCalled()
  })
})

describe('taking an update while the app is put away', () => {
  it('applies a waiting update once the app has been hidden long enough', async () => {
    await registerServiceWorker()
    const pending = harness.fireUpdateFound()

    setVisibility('hidden')
    expect(pending.postMessage).not.toHaveBeenCalled()

    vi.advanceTimersByTime(20 * 1000)

    expect(pending.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
    fireControllerChange()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  // The whole point of the delay. Looking something up and coming straight back is not
  // putting the app away, and a reload there is exactly the mid-session swap the rest
  // of this file is careful to avoid.
  it('leaves a quick glance away alone', async () => {
    await registerServiceWorker()
    const pending = harness.fireUpdateFound()

    setVisibility('hidden')
    vi.advanceTimersByTime(5 * 1000)
    setVisibility('visible')
    vi.advanceTimersByTime(60 * 1000)

    expect(pending.postMessage).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
  })

  // Timers are throttled while a tab is hidden, so the one scheduled on the way out
  // can land after the user is back. What it does then is nothing.
  it('does not apply if the timer lands after the app is back in view', async () => {
    await registerServiceWorker()
    const pending = harness.fireUpdateFound()

    setVisibility('hidden')
    // Back in view without the visibilitychange the real browser would fire: the
    // cancellation on the way in is not what is under test here.
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    vi.advanceTimersByTime(20 * 1000)

    expect(pending.postMessage).not.toHaveBeenCalled()
  })

  it('does nothing while the app is put away with no update waiting', async () => {
    await registerServiceWorker()

    setVisibility('hidden')
    vi.advanceTimersByTime(20 * 1000)

    expect(reload).not.toHaveBeenCalled()
  })

  // The app was already in the background when the update finished installing, so the
  // timer scheduled on the way out had nothing to apply when it was set.
  it('applies an update that installs after the app is already hidden', async () => {
    await registerServiceWorker()

    setVisibility('hidden')
    vi.advanceTimersByTime(20 * 1000)
    const pending = harness.fireUpdateFound()
    vi.advanceTimersByTime(20 * 1000)

    expect(pending.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
  })

  // Another window took the update while this one was in the background.
  it('catches a hidden tab up when another tab applies the update', async () => {
    await registerServiceWorker()
    harness.fireUpdateFound()

    setVisibility('hidden')
    fireControllerChange()

    expect(reload).toHaveBeenCalledTimes(1)
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

  // Being put away is the other half of the pair, and it is the more useful half:
  // finding the update on the way out is what lets the hidden timer apply it before
  // the app is next opened, rather than one visit later.
  it('checks when the app is put away', async () => {
    await registerServiceWorker()
    harness.registration.update.mockClear()

    setVisibility('hidden')

    expect(harness.registration.update).toHaveBeenCalledTimes(1)
  })

  it('checks again when a device that launched offline gets a network', async () => {
    await registerServiceWorker()
    harness.registration.update.mockClear()

    window.dispatchEvent(new Event('online'))

    expect(harness.registration.update).toHaveBeenCalledTimes(1)
  })

  it('survives a check that fails because the device is offline', async () => {
    await registerServiceWorker()
    harness.registration.update.mockRejectedValue(new Error('Failed to fetch'))

    expect(() => vi.advanceTimersByTime(60 * 60 * 1000)).not.toThrow()
  })
})
