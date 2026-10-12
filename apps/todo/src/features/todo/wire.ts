/**
 * The todo rows as `POST /api/sync` spells them, and the mapping to and from this app's own.
 *
 * Snake_case only: the server's `TodoItemData` and `TodoListData` take no camelCase aliases,
 * and one wrong key fails the whole sync with a `400`. `sync_state`, `version` and
 * `is_deleted` are required in both. See `src/routes/sync/types.rs` in `teddy-fyi-api-rust`.
 *
 * `fromWire` is defensive about everything the server could leave out, because a row written
 * by an older Android build is still a row this app has to show.
 */
import type { SyncState, TodoItem, TodoList } from './types'

export interface WireTodoList {
  id: string
  name: string
  color_hex: string
  user_id: string | null
  created_at: number
  sync_state: string
  version: number
  is_deleted: boolean
}

export interface WireTodoItem {
  id: string
  title: string
  is_completed: boolean
  created_at: number
  position: number
  scheduled_date: string | null
  recurrence_rule: string | null
  scheduled_at: number
  user_id: string | null
  parent_id: string | null
  is_daily: boolean
  due_date: number | null
  description: string | null
  list_id: string | null
  priority: number
  icon: string | null
  sync_state: string
  version: number
  is_deleted: boolean
}

export interface ChangeDelta<T> {
  id: string
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  version: number
  data: T | null
}

const SYNC_STATES: readonly SyncState[] = ['PENDING_INSERT', 'PENDING_UPDATE', 'PENDING_DELETE', 'SYNCED', 'NEED_UPDATE']

function syncStateOf(raw: unknown): SyncState {
  return SYNC_STATES.includes(raw as SyncState) ? (raw as SyncState) : 'SYNCED'
}

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback)
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null)
const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

export function listToWire(list: TodoList): WireTodoList {
  return {
    id: list.id,
    name: list.name,
    color_hex: list.colorHex,
    user_id: list.userId,
    created_at: list.createdAt,
    sync_state: list.syncState,
    version: list.version,
    is_deleted: list.isDeleted,
  }
}

export function listFromWire(raw: Partial<Record<keyof WireTodoList, unknown>>): TodoList {
  return {
    id: str(raw.id),
    name: str(raw.name),
    colorHex: str(raw.color_hex, '#03DAC5'),
    userId: strOrNull(raw.user_id),
    createdAt: num(raw.created_at, Date.now()),
    syncState: syncStateOf(raw.sync_state),
    version: num(raw.version, 1),
    isDeleted: raw.is_deleted === true,
  }
}

export function itemToWire(item: TodoItem): WireTodoItem {
  return {
    id: item.id,
    title: item.title,
    is_completed: item.isCompleted,
    created_at: item.createdAt,
    position: item.position,
    scheduled_date: item.scheduledDate,
    recurrence_rule: item.recurrenceRule,
    scheduled_at: item.scheduledAt,
    user_id: item.userId,
    parent_id: item.parentId,
    is_daily: item.isDaily,
    due_date: item.dueDate,
    description: item.description,
    list_id: item.listId,
    priority: item.priority,
    icon: item.icon,
    sync_state: item.syncState,
    version: item.version,
    is_deleted: item.isDeleted,
  }
}

/** `local` is this device's copy, if any: the one field the server never stores comes from it. */
export function itemFromWire(raw: Partial<Record<keyof WireTodoItem, unknown>>, local?: TodoItem): TodoItem {
  const createdAt = num(raw.created_at, Date.now())
  return {
    id: str(raw.id),
    title: str(raw.title),
    isCompleted: raw.is_completed === true,
    createdAt,
    position: num(raw.position),
    scheduledDate: strOrNull(raw.scheduled_date),
    recurrenceRule: strOrNull(raw.recurrence_rule),
    scheduledAt: num(raw.scheduled_at, createdAt),
    userId: strOrNull(raw.user_id),
    parentId: strOrNull(raw.parent_id),
    isDaily: raw.is_daily === true,
    dueDate: numOrNull(raw.due_date),
    description: strOrNull(raw.description),
    listId: strOrNull(raw.list_id),
    priority: num(raw.priority),
    icon: strOrNull(raw.icon),
    lastScheduledDate: local?.lastScheduledDate ?? null,
    syncState: syncStateOf(raw.sync_state),
    version: num(raw.version, 1),
    isDeleted: raw.is_deleted === true,
  }
}

/** A dirty row as a change: `DELETE` carries no data, `PENDING_INSERT` is an `INSERT`. */
export function toDelta<Row extends { id: string; syncState: SyncState; version: number; isDeleted: boolean }, W>(
  row: Row,
  toWire: (row: Row) => W,
): ChangeDelta<W> {
  if (row.isDeleted || row.syncState === 'PENDING_DELETE') {
    return { id: row.id, type: 'DELETE', version: row.version, data: null }
  }
  return {
    id: row.id,
    type: row.syncState === 'PENDING_INSERT' ? 'INSERT' : 'UPDATE',
    version: row.version,
    data: row.syncState === 'NEED_UPDATE' ? null : toWire(row),
  }
}
