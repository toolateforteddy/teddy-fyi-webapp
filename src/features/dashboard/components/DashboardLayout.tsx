import { useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
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
  Plus
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { getSyncedTimeString } from '@/utils/date'
import { GroceryProvider, useGrocery } from '@/features/grocery/context/GroceryContext'
import { ShareListSheet } from './ShareListSheet'
import { JoinListSheet } from './JoinListSheet'

function DashboardContent() {
  const location = useLocation()
  const currentPath = location.pathname

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
    lastSyncedAt,
    handleManualSync
  } = useGrocery()

  const [showSyncTooltip, setShowSyncTooltip] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [isJoinOpen, setIsJoinOpen] = useState(false)

  const activeList = lists.find(l => l.id === activeListId && !l.is_deleted) || lists.find(l => !l.is_deleted) || lists[0]

  if (!activeList) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col justify-center items-center font-sans antialiased">
        <div className="w-full max-w-md min-h-screen bg-black flex flex-col items-center justify-center border-x border-[#1a1a1a] shadow-[0_0_50px_0_rgba(208,188,255,0.05)] space-y-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <span className="text-xs text-text-muted font-medium tracking-wide animate-pulse">
            Initializing your lists...
          </span>
        </div>
      </div>
    )
  }

  const navItems = [
    {
      path: '/grocery',
      label: 'Need',
      icon: ShoppingBag,
    },
    {
      path: '/grocery/planning',
      label: 'Planning',
      icon: Calendar,
    },
    {
      path: '/grocery/shopping',
      label: 'Shopping',
      icon: CheckSquare,
    },
    {
      path: '/grocery/settings',
      label: 'Settings',
      icon: SettingsIcon,
    },
  ]

  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-between items-center font-sans antialiased selection:bg-primary selection:text-black">
      {/* Mobile container wrapper (App Frame) */}
      <div className="w-full max-w-md min-h-screen bg-black flex flex-col relative border-x border-[#1a1a1a] shadow-[0_0_50px_0_rgba(208,188,255,0.05)] pb-[72px]">
        
        {/* Top App Bar */}
        <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-md border-b border-[#1a1a1a] h-14 flex items-center justify-between px-4">
          {/* Logo / Branding */}
          <div className="flex items-center gap-2 select-none">
            <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs">
              G
            </div>
            <span className="text-sm font-bold tracking-wider text-white">
              Grocery: {activeList.name}
            </span>
          </div>

          {/* Actions & Sync Feedback */}
          <div className="flex items-center gap-2">
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
                aria-label="Sync status"
              >
                <RefreshCw className={cn(
                  "w-4 h-4 transition-all duration-700",
                  syncStatus === 'syncing' && "animate-spin text-primary",
                  syncStatus === 'synced' && "text-emerald-500",
                  syncStatus === 'stale' && "text-yellow-500 animate-pulse"
                )} />
                {syncStatus === 'stale' && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-yellow-500" />
                )}
              </button>

              {showSyncTooltip && (
                <div className="absolute right-0 mt-2 w-48 bg-surface-tile border border-neutral-800 p-2.5 rounded-lg shadow-lg z-50 text-xs text-text-muted animate-in fade-in duration-100">
                  <div className="flex items-center gap-1.5 mb-1">
                    {syncStatus === 'synced' && (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="font-semibold text-emerald-500">Synced</span>
                      </>
                    )}
                    {syncStatus === 'stale' && (
                      <>
                        <AlertCircle className="w-3.5 h-3.5 text-yellow-500" />
                        <span className="font-semibold text-yellow-500">Stale state</span>
                      </>
                    )}
                    {syncStatus === 'syncing' && (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 text-primary animate-spin" />
                        <span className="font-semibold text-primary">Syncing...</span>
                      </>
                    )}
                  </div>
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

        {/* Primary Page Outlet */}
        <main className="flex-1 overflow-y-auto px-4 py-4 scroll-smooth">
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

        {/* Bottom Navigation Bar */}
        <nav className="fixed bottom-0 w-full max-w-md bg-black/90 backdrop-blur-lg border-t border-[#1a1a1a] h-[68px] flex items-center justify-around px-2 z-40 shadow-[0_-10px_20px_rgba(0,0,0,0.5)]">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = currentPath === item.path

            return (
              <Link
                key={item.path}
                to={item.path}
                className="flex flex-col items-center justify-center w-16 h-12 rounded-xl transition-all cursor-pointer group active:scale-95"
              >
                <div className={cn(
                  "p-1.5 rounded-full transition-all group-hover:bg-neutral-900",
                  isActive ? "bg-primary/10 text-primary scale-110" : "text-text-muted"
                )}>
                  <Icon className="w-5 h-5 transition-transform" />
                </div>
                <span className={cn(
                  "text-[10px] font-medium tracking-wide mt-1 transition-colors",
                  isActive ? "text-primary font-semibold" : "text-text-muted group-hover:text-neutral-300"
                )}>
                  {item.label}
                </span>
              </Link>
            )
          })}
        </nav>

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
