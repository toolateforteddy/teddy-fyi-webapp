/**
 * Installability: whether this app can be added to the home screen, and how.
 *
 * Chrome and Edge fire `beforeinstallprompt` when they decide the app qualifies,
 * and the event is only useful if it is *captured* -- calling `preventDefault` on
 * it suppresses the browser's own mini-infobar and hands us the one chance to show
 * the prompt where it makes sense. It also fires early, often before React has
 * mounted, which is why this listener is installed from `main.tsx` at module scope
 * rather than from a component: an event that fires before the subscriber exists is
 * an install prompt that never appears.
 *
 * Safari implements none of this. On iOS the only route is Share -> Add to Home
 * Screen, done by hand, so the best that can be offered there is the instruction --
 * hence `installKind` rather than a boolean: 'prompt' means we can do it for them,
 * 'instructions' means we can only say how, 'none' means there is nothing to say
 * (either it is already installed, or the browser will never allow it).
 */

/** The event Chrome hands us. Not in lib.dom, so it is spelled out here. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallKind = 'prompt' | 'instructions' | 'none'

type Listener = (kind: InstallKind) => void

const listeners = new Set<Listener>()

let deferred: BeforeInstallPromptEvent | null = null
let installed = false

/**
 * Running as an installed app rather than in a browser tab.
 *
 * Two checks because the two platforms disagree: `display-mode: standalone` is the
 * standard one, and `navigator.standalone` is Safari's, which is the only signal on
 * the platform where it matters most.
 */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const displayMode =
    typeof window.matchMedia === 'function' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches)
  const iosStandalone = (window.navigator as { standalone?: boolean }).standalone === true
  return Boolean(displayMode) || iosStandalone
}

/**
 * An iOS browser -- every one of which is Safari's engine, including "Chrome".
 *
 * iPadOS reports itself as a Mac, so the touch-point check is what separates an
 * iPad from a desktop that would never need these instructions.
 */
export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  if (/iPhone|iPod/.test(ua)) return true
  return /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

function currentKind(): InstallKind {
  if (installed || isStandalone()) return 'none'
  if (deferred) return 'prompt'
  if (isIos()) return 'instructions'
  return 'none'
}

function announce() {
  const kind = currentKind()
  listeners.forEach(listener => listener(kind))
}

/**
 * Start capturing. Called once from `main.tsx`, before React mounts.
 *
 * Returns a teardown so tests can put the module back; nothing in the app calls it.
 */
export function listenForInstallPrompt(): () => void {
  if (typeof window === 'undefined') return () => {}

  const onBeforeInstallPrompt = (event: Event) => {
    // Suppresses Chrome's own infobar. Without it the browser shows its banner and
    // the event is wasted.
    event.preventDefault()
    deferred = event as BeforeInstallPromptEvent
    announce()
  }

  const onInstalled = () => {
    installed = true
    deferred = null
    announce()
  }

  window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  window.addEventListener('appinstalled', onInstalled)

  return () => {
    window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.removeEventListener('appinstalled', onInstalled)
  }
}

export function subscribeToInstall(listener: Listener): () => void {
  listeners.add(listener)
  listener(currentKind())
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Show the browser's install dialog. Resolves to what the user chose.
 *
 * The captured event is single-use: whatever the outcome, Chrome will not accept a
 * second `prompt()` on it. Dropping it here is what keeps a second tap from
 * throwing, and a dismissal simply means Chrome may offer a fresh event later.
 */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const event = deferred
  if (!event) return 'unavailable'

  deferred = null
  announce()

  try {
    await event.prompt()
    const { outcome } = await event.userChoice
    return outcome
  } catch (error) {
    console.warn('[PWA] Install prompt failed:', error)
    return 'unavailable'
  }
}

/** Test seam. Puts the module back to its just-loaded state. */
export function resetInstallStateForTests() {
  listeners.clear()
  deferred = null
  installed = false
}
