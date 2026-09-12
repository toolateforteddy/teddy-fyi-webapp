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
  ACTIVE_LIST_ID: 'grocery_active_list_id',
  ITEM_STORE_INFOS: 'grocery_item_store_infos',
  LIST_MEMBERS: 'grocery_list_members',
  // Retired: the Settings page no longer lets a device pick a backend. Kept only so
  // axios can clear a value an older build left behind.
  LEGACY_API_BASE_URL: 'grocery_api_base_url',
} as const;

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];
