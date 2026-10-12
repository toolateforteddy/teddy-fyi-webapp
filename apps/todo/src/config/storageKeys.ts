/**
 * Every localStorage key this app uses.
 *
 * Its own `todo_` prefix even though the origin is its own and nothing else could read them:
 * the names say which app wrote a value when somebody is reading DevTools, and a grocery key
 * copied into this app by mistake would otherwise look like it belonged.
 */
export const STORAGE_KEYS = {
  REFRESH_TOKEN: 'refresh_token',
  USER_INFO: 'user_info',
  // Also the session id `/auth/refresh` looks a session up by, so it must survive reloads.
  CLIENT_UUID: 'todo_client_id',
  LAST_SYNCED: 'todo_last_synced',
  ITEMS: 'todo_items',
  LISTS: 'todo_lists',
  // `{ [listId]: position }`. The server does not store a space's position, so the order is
  // this device's own, exactly as it is on Android.
  LIST_ORDER: 'todo_list_order',
  SELECTED_LIST_ID: 'todo_selected_list_id',
  MODE: 'todo_mode',
  // Parent ids whose subtasks are shown. Collapsed is the default, as on Android; this device's own.
  EXPANDED_PARENTS: 'todo_expanded_parents',
  // Epoch ms of the last midnight rollover / 08:00 daily reset this device ran.
  LAST_RESET_TIME: 'todo_last_reset_time',
} as const

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS]
