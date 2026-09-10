/**
 * A one-shot loader for Google Identity Services.
 *
 * `LoginForm` mounts the script itself because it owns the whole login screen;
 * the pairing page needs the same script and does not, so the loading half
 * lives here where both a component and a test can reach it. The script is
 * loaded once per page load however many callers ask for it.
 */

export interface GoogleCredentialResponse {
  credential?: string
}

interface GoogleIdentityApi {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string
        callback: (response: GoogleCredentialResponse) => void
        auto_select?: boolean
      }) => void
      renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void
    }
  }
}

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

let loader: Promise<GoogleIdentityApi> | null = null

/** Load the GIS client script once, and resolve with its API. */
export function loadGoogleIdentity(): Promise<GoogleIdentityApi> {
  const loaded = (window as { google?: GoogleIdentityApi }).google
  if (loaded?.accounts?.id) return Promise.resolve(loaded)
  if (loader) return loader

  loader = new Promise<GoogleIdentityApi>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`)
    const script = existing ?? document.createElement('script')

    script.addEventListener('load', () => {
      const api = (window as { google?: GoogleIdentityApi }).google
      if (api?.accounts?.id) resolve(api)
      else reject(new Error('Google Identity Services loaded without an accounts API'))
    })
    script.addEventListener('error', () => {
      // Cleared so a reload of the page, or a later mount, can try again.
      loader = null
      reject(new Error('Could not reach Google to load sign-in'))
    })

    if (!existing) {
      script.src = SCRIPT_SRC
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }
  })

  return loader
}

/**
 * Read the account's email out of a Google ID token so the page can show which
 * account it is about to attach the tablet to. The token is only ever verified
 * by the API; this is display copy, not a security check.
 */
export function emailFromIdToken(idToken: string): string | null {
  const payload = idToken.split('.')[1]
  if (!payload) return null
  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    const claims = JSON.parse(json) as { email?: string }
    return claims.email ?? null
  } catch {
    return null
  }
}
