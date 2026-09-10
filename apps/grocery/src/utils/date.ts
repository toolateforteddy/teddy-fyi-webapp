/**
 * Formats an ISO 8601 timestamp into a human-readable relative time string.
 */
export function getSyncedTimeString(lastSyncedAt: string): string {
  const lastSyncedMs = Date.parse(lastSyncedAt)
  if (isNaN(lastSyncedMs)) return 'never'
  
  const diffMin = Math.floor((Date.now() - lastSyncedMs) / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  return `${Math.floor(diffHours / 24)}d ago`
}
