import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLogin } from '../hooks/useLogin'
import { env } from '@/config/env'

interface GoogleIdCredentialResponse {
  credential?: string
  select_by?: string
}

interface GoogleIdConfiguration {
  client_id: string
  callback: (response: GoogleIdCredentialResponse) => void
  auto_select?: boolean
}

interface GoogleIdRenderButtonConfig {
  type?: string
  theme?: string
  size?: string
  text?: string
  shape?: string
  width?: number
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: GoogleIdConfiguration) => void
          renderButton: (element: HTMLElement, config: GoogleIdRenderButtonConfig) => void
          prompt: () => void
        }
      }
    }
  }
}

export function LoginForm() {
  const { loginWithGoogle, isLoading, error, needsInvite } = useLogin()
  const navigate = useNavigate()
  const buttonRef = useRef<HTMLDivElement>(null)
  const [scriptLoaded, setScriptLoaded] = useState(() => !!window.google?.accounts?.id)
  const [gsiError, setGsiError] = useState<string | null>(null)
  const [inviteCode, setInviteCode] = useState('')

  /**
   * The invite code as the Google callback will see it.
   *
   * A ref rather than the state value itself, because the callback is handed to
   * `google.accounts.id.initialize` once and then lives inside Google's button. Closing over
   * the state would capture whatever was typed at the moment the button was rendered -- which
   * is "" -- and re-running the effect on every keystroke to fix that would tear down and
   * redraw Google's button under the person's fingers.
   */
  const inviteCodeRef = useRef('')

  useEffect(() => {
    // Check if script is already present
    if (window.google?.accounts?.id) {
      return
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.id = 'gsi-client-script'
    script.onload = () => {
      setScriptLoaded(true)
    }
    script.onerror = () => {
      setGsiError('Failed to load Google Identity Services SDK.')
    }
    document.body.appendChild(script)

    return () => {
      const addedScript = document.getElementById('gsi-client-script')
      if (addedScript) {
        addedScript.remove()
      }
    }
  }, [])

  useEffect(() => {
    if (!scriptLoaded || !buttonRef.current || !window.google?.accounts?.id) {
      return
    }

    const clientId = env.GOOGLE_CLIENT_ID

    try {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response: GoogleIdCredentialResponse) => {
          if (response.credential) {
            try {
              await loginWithGoogle(response.credential, inviteCodeRef.current)
              navigate('/')
            } catch (err) {
              console.error('Google Sign-In exchange failed:', err)
            }
          }
        },
        auto_select: false,
      })

      window.google.accounts.id.renderButton(buttonRef.current, {
        type: 'standard',
        theme: 'filled_black',
        size: 'large',
        text: 'signin_with',
        shape: 'rectangular',
        width: 320,
      })
    } catch (err: unknown) {
      console.error('Failed to initialize Google Login button:', err)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGsiError('Failed to initialize Google Login button.')
    }
  }, [scriptLoaded, loginWithGoogle, navigate])

  return (
    <div className="flex flex-col items-center justify-center gap-4 w-full">
      {needsInvite && (
        <div className="w-[320px] flex flex-col gap-2 bg-neutral-900/60 border border-neutral-800 px-3 py-3 rounded-lg">
          <p className="text-sm text-neutral-200 font-semibold">There&apos;s no account here yet</p>
          <p className="text-xs text-text-muted">
            Signing in worked — there just isn&apos;t an account for you yet, and this app
            can&apos;t open one. If somebody sent you an invite code, paste it here and sign in
            again.
          </p>
          <input
            type="text"
            value={inviteCode}
            onChange={(e) => {
              setInviteCode(e.target.value)
              inviteCodeRef.current = e.target.value
            }}
            placeholder="Invite code"
            aria-label="Invite code"
            className="w-full bg-neutral-950 border border-neutral-800 focus:border-neutral-600 outline-none text-neutral-200 text-xs px-2.5 py-2 rounded-md"
          />
        </div>
      )}

      {gsiError && (
        <div className="text-red-400 text-xs bg-red-950/20 border border-red-500/20 px-3 py-2.5 rounded-lg text-center max-w-xs">
          {gsiError}
        </div>
      )}

      {error && (
        <div className="text-red-400 text-xs bg-red-950/20 border border-red-500/20 px-3 py-2.5 rounded-lg text-center max-w-xs">
          {error.message}
        </div>
      )}

      {/* Google Login Button Target Mount Container */}
      <div
        ref={buttonRef}
        className="min-h-[48px] flex items-center justify-center transition-all duration-300"
        style={{ opacity: isLoading || !scriptLoaded ? 0.6 : 1 }}
      />

      {env.isDev && (
        <button
          type="button"
          onClick={async () => {
            try {
              // Pass a token with base64 payload that decodes to sub = "dev_user_123"
              // {"sub":"dev_user_123"} base64url is eyJzdWIiOiJkZXZfdXNlcl8xMjMifQ
              await loginWithGoogle("mock.eyJzdWIiOiJkZXZfdXNlcl8xMjMifQ.mock")
              navigate('/')
            } catch (err) {
              console.error('Mock dev login failed:', err)
            }
          }}
          disabled={isLoading}
          className="w-[320px] mt-2 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-white font-semibold text-xs py-3 px-5 rounded-lg active:scale-[0.98] transition-all cursor-pointer shadow-md flex items-center justify-center gap-2"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Dev Mode: Bypass Auth</span>
        </button>
      )}

      {(isLoading || !scriptLoaded) && (
        <div className="text-xs text-text-muted animate-pulse">
          {isLoading ? 'Authenticating credentials...' : 'Bootstrapping Google Services...'}
        </div>
      )}
    </div>
  )
}
export default LoginForm
