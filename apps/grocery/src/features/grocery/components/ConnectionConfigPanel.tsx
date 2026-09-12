import { cn } from '@/utils/cn'

interface ConnectionConfigPanelProps {
  syncInterval: string
  onChangeSyncInterval: (interval: string) => void
  pendingChanges: number
}

export function ConnectionConfigPanel({
  syncInterval,
  onChangeSyncInterval,
  pendingChanges
}: ConnectionConfigPanelProps) {
  return (
    <div className="space-y-3">
      <div className="bg-surface-tile border border-neutral-900 rounded-xl p-4 space-y-4">
        {/* Sync status */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-muted font-medium">Pending Local Mutations</span>
          <span className={cn(
            "font-bold text-xs px-2.5 py-0.5 rounded-full",
            pendingChanges > 0 ? "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20" : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
          )}>
            {pendingChanges} changes queued
          </span>
        </div>

        {/* Sync Frequency dropdown */}
        <div className="space-y-1.5">
          <label className="text-xs text-text-muted font-medium block">
            Auto-Sync Frequency
          </label>
          <select
            value={syncInterval}
            onChange={(e) => onChangeSyncInterval(e.target.value)}
            className="w-full bg-black/40 border border-neutral-800 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:border-primary text-white cursor-pointer"
          >
            <option value="auto" className="bg-surface-tile">Real-time (On change)</option>
            <option value="hourly" className="bg-surface-tile">Every Hour</option>
            <option value="manual" className="bg-surface-tile">Manual Only</option>
          </select>
        </div>
      </div>
    </div>
  )
}
