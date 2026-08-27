import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { storage } from './utils/storage'
import { STORAGE_KEYS } from './config/storageKeys'

// One-time automatic purge of local storage fake data.
// NOTE: storage.setItem writes plain strings raw, but storage.getItem runs them
// back through JSON.parse - so the string 'true' round-trips as the boolean true.
// Accept both, or this "one-time" purge wipes the user's local data on every load.
const cleared = storage.getItem<boolean | string>('fake_data_cleared_v1', false)
if (cleared !== true && cleared !== 'true') {
  storage.removeItem(STORAGE_KEYS.ITEMS)
  storage.removeItem(STORAGE_KEYS.LISTS)
  storage.removeItem(STORAGE_KEYS.STORES)
  storage.removeItem(STORAGE_KEYS.CATEGORIES)
  storage.removeItem(STORAGE_KEYS.LAST_SYNCED)
  storage.setItem('fake_data_cleared_v1', 'true')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
