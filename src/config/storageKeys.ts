export const STORAGE_KEYS = {
  REFRESH_TOKEN: 'refresh_token',
  USER_INFO: 'user_info',
  CLIENT_UUID: 'grocery_client_id',
  LAST_SYNCED: 'grocery_last_synced',
  SELECTED_STORE_ID: 'grocery_selected_store_id',
  ITEMS: 'grocery_items',
  LISTS: 'grocery_lists',
  STORES: 'grocery_stores',
  CATEGORIES: 'grocery_categories',
  API_BASE_URL: 'grocery_api_base_url',
  ACTIVE_LIST_ID: 'grocery_active_list_id',
} as const;

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];
