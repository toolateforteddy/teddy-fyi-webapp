import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { 
  ShoppingBag, 
  Calendar, 
  CheckSquare, 
  Settings as SettingsIcon, 
  RefreshCw, 
  CheckCircle2,
  AlertCircle,
  Loader2,
  Pencil,
  Share2,
  Plus,
  WifiOff,
  UploadCloud
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { getSyncedTimeString } from '@/utils/date'
import { useAppLayout } from '@/hooks/useAppLayout'
import { GroceryProvider, useGrocery, type SyncStatus } from '@/features/grocery/context/GroceryContext'
import { AppNav, type NavItem } from './AppNav'
import { ShareListSheet } from './ShareListSheet'
import { JoinListSheet } from './JoinListSheet'
import { UpdateBanner } from '@/features/pwa/components/UpdateBanner'
import { InstallBanner } from '@/features/pwa/components/InstallBanner'

/**
 * What the sync icon says, in each of the five states.
 *
 * The two states beyond synced/syncing/stale are the ones a shopper in a basement
 * aisle actually needs. `offline` says the changes are safe and says why they have
 * not gone up; `pending` says the same changes are not going up *despite* a network,
 * which is the only one of the five worth investigating. Collapsing them back into
 * one amber dot is what made "no signal" and "idle tab" look identical.
 */
function describeSync(status: SyncStatus, pendingCount: number) {
  const changes = `${pendingCount} ${pendingCount === 1 ? 'change' : 'changes'}`

  switch (status) {
    case 'syncing':
      return {
        Icon: RefreshCw,
        tone: 'text-primary',
        dotTone: '',
        spin: true,
        label: 'Syncing...',
        detail: null,
        showDot: false,
      }
    case 'offline':
      return {
        Icon: WifiOff,
        tone: 'text-amber-500',
        dotTone: 'bg-amber-500',
        spin: false,
        label: 'Offline',
        detail:
          pendingCount > 0
            ? `${changes} will send when you are back online.`
            : 'Everything here is saved on this device.',
        showDot: true,
      }
    case 'pending':
      return {
        Icon: UploadCloud,
        tone: 'text-yellow-500',
        dotTone: 'bg-yellow-500',
        spin: false,
        label: `${changes} to send`,
        detail: 'Sending shortly. Tap to send them now.',
        showDot: true,
      }
    case 'stale':
      return {
        Icon: AlertCircle,
        tone: 'text-yellow-500',
        dotTone: 'bg-yellow-500',
        spin: false,
        label: 'Stale state',
        detail: 'Nothing has come down from the server in a while.',
        showDot: true,
      }
    case 'synced':
    default:
      return {
        Icon: CheckCircle2,
        tone: 'text-emerald-500',
        dotTone: '',
        spin: false,
        label: 'Synced',
        detail: null,
        showDot: false,
      }
  }
}

function DashboardContent() {
  const location = useLocation()
  const currentPath = location.pathname
  const { nav: navPlacement, compact, railLabels, wide } = useAppLayout()

  const {
    activeListId,
    setActiveListId,
    items,
    setItems,
    lists,
    setLists,
    listMembers,
    setListMembers,
    stores,
    setStores,
    categories,
    setCategories,
    itemStoreInfos,
    setItemStoreInfos,
    syncStatus,
    pendingCount,
    lastSyncedAt,
    handleManualSync
  } = useGrocery()

  const [showSyncTooltip, setShowSyncTooltip] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [isJoinOpen, setIsJoinOpen] = useState(false)

  const sync = describeSync(syncStatus, pendingCount)

  const activeList = lists.find(l => l.id === activeListId && !l.is_deleted) || lists.find(l => !l.is_deleted) || lists[0]

  if (!activeList) {
    return (
      <div className="h-dvh bg-black text-white flex justify-center items-center font-sans antialiased">
        <div className="app-frame app-shell h-dvh bg-black flex flex-col items-center justify-center border-x border-[#1a1a1a] shadow-[0_0_50px_0_rgba(208,188,255,0.05)] space-y-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <span className="text-xs text-text-muted font-medium tracking-wide animate-pulse">
            Initializing your lists...
          </span>
        </div>
      </div>
    )
  }

  const navItems: NavItem[] = [
    {
      path: '/',
      label: 'Need',
      icon: ShoppingBag,
    },
    {
      path: '/planning',
      label: 'Planning',
      icon: Calendar,
    },
    {
      path: '/shopping',
      label: 'Shopping',
      icon: CheckSquare,
    },
    {
      path: '/settings',
      label: 'Settings',
      icon: SettingsIcon,
    },
  ]

  return (
    <div className="h-dvh overflow-hidden bg-black text-white flex justify-center font-sans antialiased selection:bg-primary selection:text-black">
      {/* App frame. Fixed to the viewport height with its own internal scroller,
          so overscroll stays inside the list instead of dragging the shell. */}
      <div
        data-nav={navPlacement}
        className={cn(
          "app-frame app-shell h-dvh bg-black flex relative overflow-hidden border-x border-[#1a1a1a] shadow-[0_0_50px_0_rgba(208,188,255,0.05)]",
          "pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]",
          navPlacement === 'rail' ? "flex-row" : "flex-col"
        )}
      >

        {/* Navigation rail (short/landscape viewports, and anything tablet-sized) */}
        {navPlacement === 'rail' && (
          <AppNav items={navItems} currentPath={currentPath} placement="rail" labelled={railLabels} />
        )}

        {/* Header + content column */}
        <div className="flex flex-col flex-1 min-w-0 min-h-0">

        {/* Top App Bar. Padded for the status bar, which the page sits under in
            standalone mode (apple-mobile-web-app-status-bar-style). */}
        <header
          className={cn(
            "app-chrome shrink-0 z-40 bg-black/80 backdrop-blur-md border-b border-[#1a1a1a] flex items-center justify-between px-4 pt-[env(safe-area-inset-top)]",
            compact ? "h-11" : "h-14"
          )}
        >
          {/* Logo / Branding */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 shrink-0 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs">
              G
            </div>
            <span className="text-sm font-bold tracking-wider text-white truncate">
              Grocery: {activeList.name}
            </span>
          </div>

          {/* Actions & Sync Feedback */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Edit List Selector Button */}
            <button
              onClick={() => setIsEditMode(!isEditMode)}
              className={cn(
                "p-2 rounded-lg border transition-all duration-200 cursor-pointer active:scale-95",
                isEditMode
                  ? "bg-primary/20 border-primary/40 text-primary"
                  : "bg-surface-tile border-neutral-800 hover:border-neutral-700 text-text-muted hover:text-white"
              )}
              aria-label="Manage lists"
              title="Manage lists"
            >
              <Pencil className="w-4 h-4" />
            </button>

            {/* Sync Status Button */}
            <div className="relative">
              <button
                onClick={handleManualSync}
                onMouseEnter={() => setShowSyncTooltip(true)}
                onMouseLeave={() => setShowSyncTooltip(false)}
                onClickCapture={() => setShowSyncTooltip(!showSyncTooltip)}
                className="p-2 rounded-lg bg-surface-tile border border-neutral-800 active:scale-95 hover:border-neutral-700 transition-all cursor-pointer relative"
                aria-label={`Sync status: ${sync.label}`}
                title={sync.label}
              >
                <sync.Icon
                  className={cn(
                    'w-4 h-4 transition-all duration-700',
                    sync.tone,
                    sync.spin && 'animate-spin'
                  )}
                />
                {sync.showDot && (
                  <span className={cn('absolute top-1 right-1 w-2 h-2 rounded-full', sync.dotTone)} />
                )}
              </button>

              {showSyncTooltip && (
                <div className="absolute right-0 mt-2 w-52 bg-surface-tile border border-neutral-800 p-2.5 rounded-lg shadow-lg z-50 text-xs text-text-muted animate-in fade-in duration-100">
                  <div className="flex items-center gap-1.5 mb-1">
                    <sync.Icon className={cn('w-3.5 h-3.5 shrink-0', sync.tone, sync.spin && 'animate-spin')} />
                    <span className={cn('font-semibold', sync.tone)}>{sync.label}</span>
                  </div>
                  {sync.detail && <p className="mb-1">{sync.detail}</p>}
                  <p>Last synced: {getSyncedTimeString(lastSyncedAt)}</p>
                  <p className="mt-1 text-[10px] text-neutral-500">Tap icon to force upload/download changes.</p>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* List Selector / Management Panel (Edit Mode) */}
        {isEditMode && (
          <div className="bg-surface-tile border-b border-[#1a1a1a] px-4 py-3.5 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <ShoppingBag className="w-4 h-4 text-primary shrink-0" />
                <span className="text-xs font-bold text-text-muted uppercase tracking-wider truncate">Active List</span>
              </div>
              <div className="relative shrink-0">
                <select
                  value={activeListId}
                  onChange={(e) => setActiveListId(e.target.value)}
                  className="bg-black border border-neutral-800 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-primary text-white cursor-pointer active:scale-95 transition-all w-[180px]"
                >
                  {lists
                    .filter(l => !l.is_deleted)
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(list => (
                      <option key={list.id} value={list.id} className="bg-surface-tile text-white">
                        {list.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setIsShareOpen(true)}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-black/40 border border-neutral-800 hover:border-neutral-700 hover:text-white rounded-lg text-xs text-text-muted active:scale-95 transition-all cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5 text-primary" />
                <span>Invite Code</span>
              </button>
              <button
                onClick={() => setIsJoinOpen(true)}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-black/40 border border-neutral-800 hover:border-neutral-700 hover:text-white rounded-lg text-xs text-text-muted active:scale-95 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-primary" />
                <span>Join List</span>
              </button>
            </div>
          </div>
        )}

        {/* Primary Page Outlet -- the one scroll container in the shell. */}
        <main
          className={cn(
            'app-scroll app-content flex flex-col flex-1 min-h-0 py-4 scroll-smooth',
            wide ? 'px-6' : 'px-4'
          )}
        >
          <Outlet context={{ 
            activeListId: activeList.id, 
            setActiveListId, 
            handleManualSync, 
            syncStatus, 
            items, 
            setItems, 
            lists, 
            setLists, 
            listMembers,
            setListMembers,
            stores, 
            setStores, 
            categories, 
            setCategories, 
            itemStoreInfos, 
            setItemStoreInfos 
          }} />
        </main>

        </div>{/* /header + content column */}

        {/* Bottom Navigation Bar (portrait / tall viewports) */}
        {navPlacement === 'bottom' && (
          <AppNav items={navItems} currentPath={currentPath} placement="bottom" />
        )}

        {/* Inside the frame, like the FAB in NeedPhase and for the same reason: it
            is fixed, but it reads --app-frame-width and --app-nav-height, and those
            resolve correctly only for a descendant -- data-nav="rail" above sets the
            nav height to 0 on this element. */}
        <UpdateBanner />
        <InstallBanner />

      </div>

      <ShareListSheet
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        activeListId={activeList.id}
      />

      <JoinListSheet
        isOpen={isJoinOpen}
        onClose={() => setIsJoinOpen(false)}
      />
    </div>
  )
}

export function DashboardLayout() {
  return (
    <GroceryProvider>
      <DashboardContent />
    </GroceryProvider>
  )
}
