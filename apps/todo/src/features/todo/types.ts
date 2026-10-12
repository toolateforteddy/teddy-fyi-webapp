/**
 * The todo rows as this app holds them: camelCase, one field per column, and nothing else.
 *
 * The wire format is snake_case and lives in `wire.ts`; nothing outside that file should ever
 * see a snake_case key. The shapes mirror the Android entities (`TodoItem.kt`, `TodoList.kt`
 * in `teddy-fyi-android`) field for field, because both clients sync the same rows.
 */

/**
 * Where a row is in its round trip to the server. `NEED_UPDATE` is Android's "send me your
 * copy"; this app never sets it but keeps it if a row arrives with it.
 */
export type SyncState = 'PENDING_INSERT' | 'PENDING_UPDATE' | 'PENDING_DELETE' | 'SYNCED' | 'NEED_UPDATE'

export interface TodoList {
  id: string
  name: string
  /** `#RRGGBB`. */
  colorHex: string
  /** The account surrogate id. The server ignores what is sent and stamps its own. */
  userId: string | null
  /** Epoch ms. */
  createdAt: number
  syncState: SyncState
  version: number
  isDeleted: boolean
}

export interface TodoItem {
  id: string
  title: string
  isCompleted: boolean
  /** Epoch ms. */
  createdAt: number
  /** Order among siblings: same `parentId` and same `listId`. May go negative. */
  position: number
  /** `yyyy-MM-dd`, the local date it is planned for. `null` is the backlog. */
  scheduledDate: string | null
  /** An RRULE subset; see `rules.ts`. Non-null means recurring. */
  recurrenceRule: string | null
  /** Epoch ms. For a recurring task, its next occurrence, which hides it until then. */
  scheduledAt: number
  userId: string | null
  /** A subtask's parent. One level deep. */
  parentId: string | null
  /** Re-armed for today every morning at 08:00. */
  isDaily: boolean
  /** Epoch ms, or null. */
  dueDate: number | null
  description: string | null
  /** The space. `null` is no space. */
  listId: string | null
  /** 0 low, 1 medium, 2 high. */
  priority: number
  /** A Material icon name from the fixed set in `icons.ts`. */
  icon: string | null
  /**
   * Set by the midnight rollover to the date an unfinished task was planned for. **Local
   * only**: the server does not store it, so the "rolled over" marker never crosses devices.
   */
  lastScheduledDate: string | null
  syncState: SyncState
  version: number
  isDeleted: boolean
}

/** The four tabs, as on Android. */
export type TodoMode = 'BACKLOG' | 'PLANNING' | 'TODAY' | 'SCHEDULED'
