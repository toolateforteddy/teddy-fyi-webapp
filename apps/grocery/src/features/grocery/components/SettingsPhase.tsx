import { useState, useEffect, useRef } from 'react'
import {
  Trash2,
  CheckCircle2,
  LogOut,
  ChevronRight,
  MapPin,
  Tag,
  HelpCircle
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { storage } from '@/utils/storage'
import { STORAGE_KEYS } from '@/config/storageKeys'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useGrocery } from '@/features/grocery/context/GroceryContext'
import { StoreConfigPanel } from './StoreConfigPanel'
import { CategoryConfigPanel } from './CategoryConfigPanel'
import { InstallCard } from '@/features/pwa/components/InstallCard'
import { ThemeCard } from '@/features/theme/components/ThemeCard'

export function SettingsPhase() {
  const { handleManualSync } = useGrocery()

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

  const { user, logout, deleteAccount } = useAuth()
  const [loggingOut, setLoggingOut] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Sub-view State
  const [activeSubView, setActiveSubView] = useState<'main' | 'stores' | 'categories'>('main')

  const timeoutId = useRef<number | null>(null)

  // Clear timeouts on unmount
  useEffect(() => {
    return () => {
      if (timeoutId.current !== null) clearTimeout(timeoutId.current)
    }
  }, [])

  const showToast = (msg: string) => {
    setSuccessMessage(msg)
    if (timeoutId.current !== null) clearTimeout(timeoutId.current)
    timeoutId.current = setTimeout(() => {
      setSuccessMessage(null)
      timeoutId.current = null
    }, 3000) as unknown as number
  }

  // Erasing the account is the one thing here that cannot be undone, so it asks first, and
  // a request that never landed says so rather than pretending: nothing was deleted, and
  // this device is still signed in.
  const handleDeleteData = async () => {
    if (!window.confirm(
      'Delete everything? Your account, your lists and everything in them are erased from the server and this device. This cannot be undone.'
    )) return
    setDeleting(true)
    const ok = await deleteAccount()
    setDeleting(false)
    if (!ok) window.alert('Nothing was deleted. Check the connection and try again.')
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
          <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-surface-raised/90 backdrop-blur-md border border-success/30 text-success-strong text-xs px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
            <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
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
          <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-surface-raised/90 backdrop-blur-md border border-success/30 text-success-strong text-xs px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
            <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
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

  // One list of rows, in the order a person reaches for them: who you are, what the list is
  // made of, how it looks, and the one thing that cannot be undone, last.
  return (
    <div className="reading-column space-y-4 animate-in fade-in duration-200">
      {successMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-surface-raised/90 backdrop-blur-md border border-success/30 text-success-strong text-xs px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
          <span className="font-semibold">{successMessage}</span>
        </div>
      )}

      <Group>
        <div className="flex items-center gap-3 px-4 py-3">
          {user?.picture ? (
            <img
              src={user.picture}
              alt=""
              className="w-9 h-9 rounded-full border border-line object-cover"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-surface-raised border border-line flex items-center justify-center text-primary font-bold text-sm">
              {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm text-text-primary truncate">{user?.name || user?.email}</p>
            {user?.name && user?.email && <p className="text-xs text-text-muted truncate">{user.email}</p>}
          </div>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-text-primary px-2 py-1.5 rounded-lg hover:bg-surface-hover cursor-pointer disabled:opacity-55"
          >
            <LogOut className="w-3.5 h-3.5" />
            {loggingOut ? 'Signing out...' : 'Sign out'}
          </button>
        </div>
      </Group>

      <Group>
        <Row icon={MapPin} label="Stores" onClick={() => setActiveSubView('stores')} />
        <Row icon={Tag} label="Categories" onClick={() => setActiveSubView('categories')} />
        <Link
          to="/help"
          className="flex items-center gap-3 px-4 h-12 text-sm font-medium text-text-primary hover:bg-surface-hover no-underline"
        >
          <HelpCircle className="w-4 h-4 text-primary shrink-0" />
          <span className="flex-1">How this works</span>
          <ChevronRight className="w-4 h-4 text-text-muted" />
        </Link>
      </Group>

      <Group>
        <div className="flex items-center gap-3 px-4 py-2.5">
          <span className="flex-1 text-sm font-medium text-text-primary">Appearance</span>
          <ThemeCard />
        </div>
        <InstallCard />
      </Group>

      <Group>
        <button
          onClick={() => { void handleDeleteData() }}
          disabled={deleting}
          className="w-full flex items-center gap-3 px-4 h-12 text-sm font-medium text-danger hover:bg-danger/10 cursor-pointer disabled:opacity-55"
        >
          <Trash2 className="w-4 h-4 shrink-0" />
          {deleting ? 'Deleting...' : 'Delete my data'}
        </button>
      </Group>
    </div>
  )
}

/** A card of rows, divided by hairlines: the whole of Settings is a few of these. */
function Group({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-surface-tile border border-line-faint rounded-xl overflow-hidden divide-y divide-line-faint">
      {children}
    </div>
  )
}

function Row({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 h-12 text-sm font-medium text-text-primary hover:bg-surface-hover cursor-pointer"
    >
      <Icon className="w-4 h-4 text-primary shrink-0" />
      <span className="flex-1 text-left">{label}</span>
      <ChevronRight className="w-4 h-4 text-text-muted" />
    </button>
  )
}
