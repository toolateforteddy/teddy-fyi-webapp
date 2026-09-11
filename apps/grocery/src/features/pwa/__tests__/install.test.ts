import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  listenForInstallPrompt,
  subscribeToInstall,
  promptInstall,
  isIos,
  isStandalone,
  resetInstallStateForTests,
} from '../install'

let teardown: () => void

/** The event Chrome fires, as much of it as this module touches. */
function beforeInstallPrompt(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const event = new Event('beforeinstallprompt') as Event & {
    prompt: ReturnType<typeof vi.fn>
    userChoice: Promise<{ outcome: string }>
  }
  event.prompt = vi.fn().mockResolvedValue(undefined)
  event.userChoice = Promise.resolve({ outcome })
  return event
}

function setUserAgent(ua: string, maxTouchPoints = 0) {
  Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true })
  Object.defineProperty(window.navigator, 'maxTouchPoints', { value: maxTouchPoints, configurable: true })
}

function setDisplayMode(standalone: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    value: (query: string) => ({ matches: standalone && query.includes('standalone'), media: query }),
    configurable: true,
  })
}

beforeEach(() => {
  resetInstallStateForTests()
  setUserAgent('Mozilla/5.0 (Linux; Android 14) Chrome/120')
  setDisplayMode(false)
  Object.defineProperty(window.navigator, 'standalone', { value: undefined, configurable: true })
  teardown = listenForInstallPrompt()
})

afterEach(() => {
  teardown()
})

describe('capturing the install prompt', () => {
  it('offers nothing until the browser says the app qualifies', () => {
    const seen: string[] = []
    subscribeToInstall(kind => seen.push(kind))

    expect(seen).toEqual(['none'])
  })

  it('offers a prompt once beforeinstallprompt fires', () => {
    const seen: string[] = []
    subscribeToInstall(kind => seen.push(kind))

    window.dispatchEvent(beforeInstallPrompt())

    expect(seen).toEqual(['none', 'prompt'])
  })

  // Without preventDefault, Chrome shows its own mini-infobar and the captured
  // event is wasted.
  it('suppresses the browser default banner', () => {
    const event = beforeInstallPrompt()
    const prevented = vi.spyOn(event, 'preventDefault')

    window.dispatchEvent(event)

    expect(prevented).toHaveBeenCalled()
  })

  it('tells a late subscriber the app is already installable', () => {
    window.dispatchEvent(beforeInstallPrompt())

    const seen: string[] = []
    subscribeToInstall(kind => seen.push(kind))

    expect(seen).toEqual(['prompt'])
  })

  it('stops offering once the app is installed', () => {
    const seen: string[] = []
    window.dispatchEvent(beforeInstallPrompt())
    subscribeToInstall(kind => seen.push(kind))

    window.dispatchEvent(new Event('appinstalled'))

    expect(seen).toEqual(['prompt', 'none'])
  })

  it('stops calling a listener once it unsubscribes', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeToInstall(listener)
    listener.mockClear()

    unsubscribe()
    window.dispatchEvent(beforeInstallPrompt())

    expect(listener).not.toHaveBeenCalled()
  })
})

describe('showing the prompt', () => {
  it('passes the choice back', async () => {
    window.dispatchEvent(beforeInstallPrompt('accepted'))

    await expect(promptInstall()).resolves.toBe('accepted')
  })

  it('reports a dismissal as a dismissal, not a failure', async () => {
    window.dispatchEvent(beforeInstallPrompt('dismissed'))

    await expect(promptInstall()).resolves.toBe('dismissed')
  })

  it('is a no-op when nothing has been captured', async () => {
    await expect(promptInstall()).resolves.toBe('unavailable')
  })

  // Chrome refuses a second prompt() on the same event, so the offer has to
  // disappear after one use rather than throw on the second tap.
  it('withdraws the offer after using it once', async () => {
    window.dispatchEvent(beforeInstallPrompt())
    const seen: string[] = []
    subscribeToInstall(kind => seen.push(kind))

    await promptInstall()

    expect(seen).toEqual(['prompt', 'none'])
    await expect(promptInstall()).resolves.toBe('unavailable')
  })

  it('survives a prompt the browser refuses', async () => {
    const event = beforeInstallPrompt()
    event.prompt = vi.fn().mockRejectedValue(new Error('not allowed'))
    window.dispatchEvent(event)

    await expect(promptInstall()).resolves.toBe('unavailable')
  })
})

describe('platforms with no install API', () => {
  it('falls back to instructions on an iPhone', () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari')
    const seen: string[] = []
    subscribeToInstall(kind => seen.push(kind))

    expect(seen).toEqual(['instructions'])
  })

  // iPadOS reports itself as a Mac; the touch points are what give it away.
  it('recognises an iPad pretending to be a Mac', () => {
    setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari', 5)

    expect(isIos()).toBe(true)
  })

  it('does not mistake a real Mac for an iPad', () => {
    setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari', 0)

    expect(isIos()).toBe(false)
  })

  it('says nothing to an iPhone that already runs it installed', () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari')
    Object.defineProperty(window.navigator, 'standalone', { value: true, configurable: true })

    expect(isStandalone()).toBe(true)
    const seen: string[] = []
    subscribeToInstall(kind => seen.push(kind))
    expect(seen).toEqual(['none'])
  })

  it('recognises an installed app by display-mode', () => {
    setDisplayMode(true)

    expect(isStandalone()).toBe(true)
  })
})
