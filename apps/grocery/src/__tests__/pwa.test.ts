import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { registerServiceWorker, unregisterServiceWorkers } from '../pwa'
import { storage } from '@/utils/storage'

const SW_DISABLED_KEY = 'grocery_sw_disabled'

const register = vi.fn()
const unregister = vi.fn()
const getRegistrations = vi.fn()
const cacheDelete = vi.fn()
const cacheKeys = vi.fn()

function installMocks() {
  unregister.mockResolvedValue(true)
  getRegistrations.mockResolvedValue([{ unregister }])
  cacheKeys.mockResolvedValue(['workbox-precache-v2', 'google-fonts-files'])
  cacheDelete.mockResolvedValue(true)
  register.mockResolvedValue({})

  Object.defineProperty(window.navigator, 'serviceWorker', {
    value: { register, getRegistrations },
    configurable: true,
    writable: true,
  })
  Object.defineProperty(window, 'caches', {
    value: { keys: cacheKeys, delete: cacheDelete },
    configurable: true,
    writable: true,
  })
}

function visit(search: string) {
  window.history.replaceState(null, '', `/${search}`)
}

beforeEach(() => {
  vi.clearAllMocks()
  installMocks()
  visit('')
})

afterEach(() => {
  visit('')
})

describe('registerServiceWorker', () => {
  it('registers the worker at the root scope on a normal load', async () => {
    await registerServiceWorker()

    expect(register).toHaveBeenCalledWith('/sw.js', { scope: '/' })
  })

  it('survives a registration that throws', async () => {
    register.mockRejectedValue(new Error('SecurityError'))

    await expect(registerServiceWorker()).resolves.toBeUndefined()
  })

  describe('the ?sw=off escape hatch', () => {
    it('unregisters every worker and deletes every cache instead of registering', async () => {
      visit('?sw=off')

      await registerServiceWorker()

      expect(register).not.toHaveBeenCalled()
      expect(unregister).toHaveBeenCalled()
      expect(cacheDelete).toHaveBeenCalledWith('workbox-precache-v2')
      expect(cacheDelete).toHaveBeenCalledWith('google-fonts-files')
    })

    it('remembers, so the next load does not install it all over again', async () => {
      visit('?sw=off')
      await registerServiceWorker()

      // A fresh load, no parameter this time.
      visit('')
      vi.clearAllMocks()
      installMocks()
      await registerServiceWorker()

      expect(register).not.toHaveBeenCalled()
      expect(unregister).toHaveBeenCalled()
    })

    it('strips the parameter so a bookmark does not keep re-triggering it', async () => {
      visit('?sw=off')

      await registerServiceWorker()

      expect(window.location.search).toBe('')
    })

    it('keeps other query parameters intact', async () => {
      visit('?list=weekly&sw=off')

      await registerServiceWorker()

      expect(window.location.search).toBe('?list=weekly')
    })
  })

  describe('the ?sw=on reversal', () => {
    it('clears the flag and registers again', async () => {
      storage.setItem(SW_DISABLED_KEY, 'true')
      visit('?sw=on')

      await registerServiceWorker()

      expect(register).toHaveBeenCalledWith('/sw.js', { scope: '/' })
      expect(storage.getItem(SW_DISABLED_KEY, false)).toBe(false)
    })
  })

  it('ignores an unrecognised sw parameter and behaves normally', async () => {
    visit('?sw=maybe')

    await registerServiceWorker()

    expect(register).toHaveBeenCalled()
    // Left alone rather than stripped: it is not ours.
    expect(window.location.search).toBe('?sw=maybe')
  })
})

describe('unregisterServiceWorkers', () => {
  it('is safe on a browser with no service worker support', async () => {
    // Both APIs absent, not merely undefined -- the guards test for the property.
    Reflect.deleteProperty(window.navigator, 'serviceWorker')
    Reflect.deleteProperty(window, 'caches')

    await expect(unregisterServiceWorkers()).resolves.toBeUndefined()
    await expect(registerServiceWorker()).resolves.toBeUndefined()
  })
})
