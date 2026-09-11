import { useState, useEffect, useRef } from 'react'
import { 
  Database, 
  RefreshCw, 
  Trash2, 
  ShieldAlert, 
  HardDrive, 
  CheckCircle2, 
  User, 
  LogOut,
  ChevronRight,
  MapPin,
  Tag,
  Smartphone
} from 'lucide-react'
import { storage } from '@/utils/storage'
import { STORAGE_KEYS } from '@/config/storageKeys'
import { setApiBaseUrl } from '@/lib/axios'
import { env } from '@/config/env'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useGrocery } from '@/features/grocery/context/GroceryContext'
import { StoreConfigPanel } from './StoreConfigPanel'
import { CategoryConfigPanel } from './CategoryConfigPanel'
import { ConnectionConfigPanel } from './ConnectionConfigPanel'
import { InstallCard } from '@/features/pwa/components/InstallCard'

export function SettingsPhase() {
  const { 
    items, 
    lists, 
    stores, 
    categories,
    handleManualSync
  } = useGrocery()

  const checkAndSync = (key: string) => {
    try {
      const raw = storage.getItem<any[]>(key, [])
      const hasUnsynced = raw.some(item => item && item.sync_state !== 'SYNCED')
      if (hasUnsynced) {
        console.log(`[Sync] Safety net: Unsynced items found in local storage for key ${key}. Triggering manual sync...`)
        handleManualSync().catch(err => console.error('[Sync] Safety net sync failed:', err))
      }
    } catch (e) {
      console.error('[Sync] Error in safety net check:', e)
    }
  }

  const { user, logout } = useAuth()
  const [loggingOut, setLoggingOut] = useState(false)
  const [syncInterval, setSyncInterval] = useState('auto')
  const [apiUrl, setApiUrl] = useState(() => {
    return storage.getItem<string>(STORAGE_KEYS.API_BASE_URL, env.API_BASE_URL)
  })
  const [clearing, setClearing] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Sub-view State
  const [activeSubView, setActiveSubView] = useState<'main' | 'stores' | 'categories'>('main')

  const timeoutId = useRef<number | null>(null)
  const reloadTimeoutId = useRef<number | null>(null)

  // Clear timeouts on unmount
  useEffect(() => {
    return () => {
      if (timeoutId.current !== null) clearTimeout(timeoutId.current)
      if (reloadTimeoutId.current !== null) clearTimeout(reloadTimeoutId.current)
    }
  }, [])

  const pendingChanges = 
    (items || []).filter(i => i.sync_state !== 'SYNCED').length +
    (lists || []).filter(l => l.sync_state !== 'SYNCED').length +
    (stores || []).filter(s => s.sync_state !== 'SYNCED').length +
    (categories || []).filter(c => c.sync_state !== 'SYNCED').length

  const totalCached = 
    (items || []).length +
    (lists || []).length +
    (stores || []).length +
    (categories || []).length

  const showToast = (msg: string) => {
    setSuccessMessage(msg)
    if (timeoutId.current !== null) clearTimeout(timeoutId.current)
    timeoutId.current = setTimeout(() => {
      setSuccessMessage(null)
      timeoutId.current = null
    }, 3000) as unknown as number
  }

  const handleSaveApiUrl = (newUrl: string) => {
    setApiUrl(newUrl)
    storage.setItem(STORAGE_KEYS.API_BASE_URL, newUrl)
    setApiBaseUrl(newUrl)
    showToast('API Base URL configuration updated.')
  }

  const handleClearLocal = () => {
    setClearing(true)
    if (timeoutId.current !== null) clearTimeout(timeoutId.current)
    timeoutId.current = setTimeout(() => {
      storage.removeItem(STORAGE_KEYS.ITEMS)
      storage.removeItem(STORAGE_KEYS.LISTS)
      storage.removeItem(STORAGE_KEYS.STORES)
      storage.removeItem(STORAGE_KEYS.CATEGORIES)
      storage.removeItem(STORAGE_KEYS.LAST_SYNCED)
      storage.removeItem(STORAGE_KEYS.ACTIVE_LIST_ID)
      storage.removeItem(STORAGE_KEYS.ITEM_STORE_INFOS)
      storage.removeItem(STORAGE_KEYS.LIST_MEMBERS)
      storage.removeItem(STORAGE_KEYS.SELECTED_STORE_ID)
      setClearing(false)
      showToast('Local cache cleared successfully. Reloading...')
      
      // Delay reload to let user see success toast
      reloadTimeoutId.current = setTimeout(() => {
        window.location.reload()
      }, 1500) as unknown as number
    }, 1000) as unknown as number
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await logout()
    } catch (error) {
      console.error('Logout failed:', error)
    } finally {
      setLoggingOut(false)
    }
  }

  // --- Render Sub-views ---

  if (activeSubView === 'stores') {
    return (
      <>
        {successMessage && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-neutral-900/90 backdrop-blur-md border border-emerald-500/30 text-emerald-400 text-xs px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="font-semibold">{successMessage}</span>
          </div>
        )}
        <StoreConfigPanel
          onBack={() => {
            setActiveSubView('main')
            checkAndSync(STORAGE_KEYS.STORES)
          }}
          showToast={showToast}
        />
      </>
    )
  }

  if (activeSubView === 'categories') {
    return (
      <>
        {successMessage && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-neutral-900/90 backdrop-blur-md border border-emerald-500/30 text-emerald-400 text-xs px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="font-semibold">{successMessage}</span>
          </div>
        )}
        <CategoryConfigPanel
          onBack={() => {
            setActiveSubView('main')
            checkAndSync(STORAGE_KEYS.CATEGORIES)
          }}
          showToast={showToast}
        />
      </>
    )
  }

  // --- Main Settings View ---

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Premium Success Toast */}
      {successMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-neutral-900/90 backdrop-blur-md border border-emerald-500/30 text-emerald-400 text-xs px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span className="font-semibold">{successMessage}</span>
        </div>
      )}

      {/* Account Info Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <User className="w-4 h-4 text-primary" />
          <h4 className="text-xs font-bold tracking-widest text-text-muted uppercase">
            Account Info
          </h4>
        </div>

        <div className="bg-surface-tile border border-neutral-900 rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-3">
            {user?.picture ? (
              <img 
                src={user.picture} 
                alt={user.name || 'User avatar'} 
                className="w-10 h-10 rounded-full border border-neutral-800 object-cover" 
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-primary font-bold">
                {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h5 className="font-semibold text-sm text-white truncate">
                {user?.name || 'Authenticated User'}
              </h5>
              <p className="text-xs text-text-muted truncate">
                {user?.email || 'No email associated'}
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full bg-neutral-900 hover:bg-neutral-855 text-white border border-neutral-800 py-2.5 rounded-lg text-xs font-bold transition-all active:scale-[0.99] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-55"
          >
            <LogOut className="w-3.5 h-3.5" />
            {loggingOut ? 'Signing out...' : 'Sign Out'}
          </button>
        </div>
      </div>

      {/* This Device */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Smartphone className="w-4 h-4 text-primary" />
          <h4 className="text-xs font-bold tracking-widest text-text-muted uppercase">
            This Device
          </h4>
        </div>

        <InstallCard />
      </div>

      {/* Grocery Configurations Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Database className="w-4 h-4 text-primary" />
          <h4 className="text-xs font-bold tracking-widest text-text-muted uppercase">
            Grocery Configurations
          </h4>
        </div>

        <div className="bg-surface-tile border border-neutral-900 rounded-xl p-4 space-y-3">
          <button
            onClick={() => setActiveSubView('stores')}
            className="w-full bg-neutral-900 hover:bg-neutral-850 text-white border border-neutral-800 py-3 px-4 rounded-lg text-sm font-semibold transition-all active:scale-[0.99] flex items-center justify-between cursor-pointer group"
          >
            <div className="flex items-center gap-2.5">
              <MapPin className="w-4 h-4 text-primary shrink-0" />
              <span>Manage Stores</span>
            </div>
            <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-white transition-colors" />
          </button>

          <button
            onClick={() => setActiveSubView('categories')}
            className="w-full bg-neutral-900 hover:bg-neutral-855 text-white border border-neutral-800 py-3 px-4 rounded-lg text-sm font-semibold transition-all active:scale-[0.99] flex items-center justify-between cursor-pointer group"
          >
            <div className="flex items-center gap-2.5">
              <Tag className="w-4 h-4 text-primary shrink-0" />
              <span>Manage Categories</span>
            </div>
            <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-white transition-colors" />
          </button>
        </div>
      </div>

      {/* Synchronization Engine Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <RefreshCw className="w-4 h-4 text-primary" />
          <h4 className="text-xs font-bold tracking-widest text-text-muted uppercase">
            Sync Engine Configuration
          </h4>
        </div>

        <ConnectionConfigPanel
          apiUrl={apiUrl}
          onSaveApiUrl={handleSaveApiUrl}
          syncInterval={syncInterval}
          onChangeSyncInterval={setSyncInterval}
          pendingChanges={pendingChanges}
        />
      </div>

      {/* Database & Caching Statistics */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Database className="w-4 h-4 text-primary" />
          <h4 className="text-xs font-bold tracking-widest text-text-muted uppercase">
            Local Database Info
          </h4>
        </div>

        <div className="bg-surface-tile border border-neutral-900 rounded-xl p-4 divide-y divide-neutral-900 text-sm">
          <div className="flex justify-between py-2.5">
            <span className="text-text-muted">Database Framework</span>
            <span className="font-semibold text-white">IndexedDB (LocalForage)</span>
          </div>
          <div className="flex justify-between py-2.5">
            <span className="text-text-muted">Database Version</span>
            <span className="font-semibold text-white">v1.0 (Schema Sync Enabled)</span>
          </div>
          <div className="flex justify-between py-2.5">
            <span className="text-text-muted">Total Cached Items</span>
            <span className="font-semibold text-white">{totalCached} records</span>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <ShieldAlert className="w-4 h-4 text-red-400" />
          <h4 className="text-xs font-bold tracking-widest text-red-400 uppercase">
            Danger Zone
          </h4>
        </div>

        <div className="bg-surface-tile border border-red-950/40 rounded-xl p-4 space-y-4">
          <div className="flex items-start gap-3">
            <HardDrive className="w-8 h-8 text-neutral-500 shrink-0" />
            <div>
              <h5 className="font-semibold text-sm text-white">Clear Caching Tables</h5>
              <p className="text-[11px] text-text-muted mt-0.5">
                Resets the local cache. Any changes that are not synced to the remote server will be permanently deleted.
              </p>
            </div>
          </div>

          <button
            onClick={handleClearLocal}
            disabled={clearing}
            className="w-full bg-red-650/10 hover:bg-red-650/20 text-red-400 border border-red-500/20 py-2.5 rounded-lg text-xs font-bold transition-all active:scale-[0.99] flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {clearing ? 'Clearing Storage...' : 'Clear Local Cache'}
          </button>
        </div>
      </div>

    </div>
  )
}
