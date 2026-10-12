import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerServiceWorker } from './pwa'
import { listenForInstallPrompt } from './features/pwa/install'
import { trackKeyboardInset } from './keyboardInset'

// Before render, unlike registration: Chrome can fire `beforeinstallprompt` while
// React is still mounting, and an event nobody is listening for is an install
// offer the user never sees.
listenForInstallPrompt()
trackKeyboardInset()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// After render, never before: registration is what makes the *next* launch work
// offline, so nothing about this load should wait on it. Errors are handled inside.
registerServiceWorker()
