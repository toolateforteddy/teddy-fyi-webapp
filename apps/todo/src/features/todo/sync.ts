/**
 * One todo sync against `POST /api/sync`, and the pure merge of its answer into local state.
 *
 * Shaped after the grocery app's sync, with the corrections the todo tables need:
 *
 * - **Acknowledgement is `success_ids`, not "it was sent".** A row is only marked synced
 *   when the server says it took it.
 * - **The server's version is adopted** from `upload_status`, so the local version keeps up
 *   with the server's and the version guard on downloads stays meaningful.
 * - **A row edited again while the request was in flight stays dirty.** Each sent row is
 *   snapshotted at send time and compared at merge time.
 * - **Paging.** `supports_paging` is sent and `has_more` followed, so a first sync of a long
 *   history arrives in pages rather than as one oversized answer.
 *
 * Todo has no server push yet — the API publishes stream events for grocery writes only — so
 * freshness comes from the status pre-check, run on a timer and on focus by `TodoContext`.
 */
import api from '@/lib/axios'
import type { TodoItem, TodoList } from './types'
import {
  itemFromWire,
  itemToWire,
  listFromWire,
  listToWire,
  toDelta,
  type ChangeDelta,
  type WireTodoItem,
  type WireTodoList,
} from './wire'

interface SyncResponse {
  success_ids?: string[]
  upload_status?: Array<{ id: string; version: number; sync_state: string }>
  remote_todo_list_changes?: ChangeDelta<WireTodoList>[]
  remote_todo_changes?: ChangeDelta<WireTodoItem>[]
  server_timestamp: string
  has_more?: boolean
}

/** What a finished sync hands back for merging. */
export interface SyncResult {
  serverTimestamp: string
  successIds: Set<string>
  uploadVersions: Map<string, number>
  remoteLists: ChangeDelta<WireTodoList>[]
  remoteItems: ChangeDelta<WireTodoItem>[]
  /** Each sent row as it was when sent, by id. */
  sentLists: Map<string, string>
  sentItems: Map<string, string>
}

/** The first sync is the one with no timestamp, or the epoch, which the server reads the same way. */
const EPOCH = new Date(0).toISOString()

/** A safety stop on `has_more`, so a server bug cannot loop a phone forever. */
const MAX_PAGES = 50

const isDirty = (row: { syncState: string }) => row.syncState !== 'SYNCED'

/**
 * Runs one sync, or returns null when the status check says there is nothing to do.
 *
 * `force` skips that check, for a sync somebody asked for.
 */
export async function runTodoSync(input: {
  items: readonly TodoItem[]
  lists: readonly TodoList[]
  lastSyncedAt: string | null
  clientId: string
  force?: boolean
}): Promise<SyncResult | null> {
  const lastSyncedAt = input.lastSyncedAt || EPOCH
  const dirtyLists = input.lists.filter(isDirty)
  const dirtyItems = input.items.filter(isDirty)

  if (dirtyLists.length === 0 && dirtyItems.length === 0 && input.lastSyncedAt && !input.force) {
    try {
      const status = await api.get<{ needs_sync: boolean }>('/api/sync/status', {
        params: { client_id: input.clientId, last_synced_at: lastSyncedAt, scope: 'TODO' },
      })
      if (!status.data.needs_sync) return null
    } catch {
      // A failed check is not a reason to skip the sync it was trying to save.
    }
  }

  const result: SyncResult = {
    serverTimestamp: lastSyncedAt,
    successIds: new Set(),
    uploadVersions: new Map(),
    remoteLists: [],
    remoteItems: [],
    sentLists: new Map(dirtyLists.map((l) => [l.id, JSON.stringify(l)])),
    sentItems: new Map(dirtyItems.map((i) => [i.id, JSON.stringify(i)])),
  }

  let since = lastSyncedAt
  for (let page = 0; page < MAX_PAGES; page++) {
    const response = await api.post<SyncResponse>('/api/sync', {
      last_synced_at: since,
      client_id: input.clientId,
      scope: 'TODO',
      supports_paging: true,
      // Lists before items on the server too, so an item's new space exists before it does.
      todo_list_changes: page === 0 ? dirtyLists.map((l) => toDelta(l, listToWire)) : [],
      todo_changes: page === 0 ? dirtyItems.map((i) => toDelta(i, itemToWire)) : [],
    })
    const body = response.data
    for (const id of body.success_ids ?? []) result.successIds.add(id)
    for (const status of body.upload_status ?? []) result.uploadVersions.set(status.id, status.version)
    result.remoteLists.push(...(body.remote_todo_list_changes ?? []))
    result.remoteItems.push(...(body.remote_todo_changes ?? []))
    result.serverTimestamp = body.server_timestamp
    since = body.server_timestamp
    if (!body.has_more) break
  }

  return result
}

type Row = { id: string; syncState: TodoItem['syncState']; version: number; isDeleted: boolean }

/**
 * Folds a sync's answer into the rows as they are *now* — which may have moved on since the
 * request was built.
 */
export function mergeRows<T extends Row, W>(
  current: readonly T[],
  sent: Map<string, string>,
  result: Pick<SyncResult, 'successIds' | 'uploadVersions'>,
  remote: ChangeDelta<W>[],
  fromWire: (data: W, local: T | undefined) => T,
  keepLocal?: (local: T, incoming: T) => T,
): T[] {
  const rows = new Map(current.map((row) => [row.id, row]))

  // 1. What the server acknowledged.
  for (const [id, snapshot] of sent) {
    if (!result.successIds.has(id)) continue
    const row = rows.get(id)
    if (!row) continue
    const version = result.uploadVersions.get(id) ?? row.version
    if (JSON.stringify(row) !== snapshot) {
      // Edited again in flight. The server has *a* copy now, so it is an update from here on.
      if (row.isDeleted) continue
      rows.set(id, { ...row, version, syncState: row.syncState === 'PENDING_INSERT' ? 'PENDING_UPDATE' : row.syncState })
    } else if (row.isDeleted) {
      rows.delete(id)
    } else {
      rows.set(id, { ...row, version, syncState: 'SYNCED' })
    }
  }

  // 2. What other devices — or the server's icon assignment — wrote.
  for (const change of remote) {
    if (change.type === 'DELETE' || (change.data as { is_deleted?: boolean } | null)?.is_deleted) {
      rows.delete(change.id)
      continue
    }
    if (!change.data) continue
    const local = rows.get(change.id)
    const incoming = { ...fromWire(change.data, local), syncState: 'SYNCED' as const, version: change.version }
    if (local && local.syncState !== 'SYNCED') {
      // A local edit not yet sent wins; it goes up on the next sync and the server is last
      // write wins. The version still moves forward so the guard below stays honest.
      rows.set(change.id, keepLocal ? keepLocal(local, incoming) : { ...local, version: Math.max(local.version, change.version) })
      continue
    }
    if (local && change.version < local.version) continue
    rows.set(change.id, incoming)
  }

  return [...rows.values()]
}

export function mergeItems(current: readonly TodoItem[], result: SyncResult): TodoItem[] {
  return mergeRows(
    current,
    result.sentItems,
    result,
    result.remoteItems,
    (data, local) => itemFromWire(data, local),
    // The server's icon arrives on the echo of a row that may already have been edited
    // again; keep the edit and take the icon.
    (local, incoming) => ({
      ...local,
      icon: local.icon ?? incoming.icon,
      version: Math.max(local.version, incoming.version),
    }),
  )
}

export function mergeLists(current: readonly TodoList[], result: SyncResult): TodoList[] {
  return mergeRows(current, result.sentLists, result, result.remoteLists, (data) => listFromWire(data))
}
