export type SyncState = 'SYNCED' | 'PENDING_INSERT' | 'PENDING_UPDATE' | 'PENDING_DELETE';

export interface GroceryItem {
  id: string; // Primary Key (UUID)
  name: string;
  quantity: string;
  isBought: boolean;
  createdAt: number; // timestamp
  position: number;
  categoryId?: string;
  timesBought: number;
  userId?: string;
  isActive: boolean;
  /** Nullable on the wire (`Option<String>` server-side); absent for an unfiled item. */
  listId?: string;
  unit?: string;
  notes?: string;
  sync_state: SyncState;
  version: number;
  is_deleted: boolean;
}

export interface GroceryList {
  id: string; // Primary Key (UUID)
  name: string;
  ownerId?: string;
  createdAt: number;
  sync_state: SyncState;
  version: number;
  is_deleted: boolean;
}

export interface GroceryListMember {
  id: string; // Primary Key (UUID)
  listId?: string;
  userId?: string;
  role: string; // e.g., 'OWNER', 'MEMBER'
  joinedAt: number;
  sync_state: SyncState;
  version: number;
  is_deleted: boolean;
}

export interface Store {
  id: string;
  name: string;
  position: number;
  isDefaultSupported: boolean;
  userId?: string;
  /** Nullable on the wire (`Option<String>` server-side). */
  listId?: string;
  sync_state: SyncState;
  version: number;
  is_deleted: boolean;
}

export interface Category {
  id: string;
  name: string;
  position: number;
  userId?: string;
  icon?: string;
  /** Nullable on the wire (`Option<String>` server-side). */
  listId?: string;
  sync_state: SyncState;
  version: number;
  is_deleted: boolean;
}

export interface GroceryItemStoreInfo {
  groceryItemId: string;
  storeId: string;
  price?: number;
  isAvailable: boolean;
  userId?: string;
  /**
   * Server-computed, read-only. There is no `listId` column on `grocery_item_store_info` —
   * the server resolves it from this row's store and ignores it on upload. Optional because
   * the server genuinely omits it for a store that belongs to no list, and because this
   * client can never make it authoritative.
   *
   * Unlike the `listId` on GroceryItem / Store / Category, which this client sets itself at
   * creation and `normalize` guarantees is a string, nothing here guarantees a value.
   */
  listId?: string;
  sync_state: SyncState;
  version: number;
  is_deleted: boolean;
}

// Synchronization Protocol Shapes

export type ChangeDeltaType = 'INSERT' | 'UPDATE' | 'DELETE';

export interface ChangeDelta<T = unknown> {
  id: number | string;
  type: ChangeDeltaType;
  version: number;
  data: T | null; // null for deletes
}

export type SyncScope = 'ALL' | 'GROCERY' | 'TODO';

export interface SyncRequest {
  last_synced_at: string; // ISO 8601 string
  client_id: string; // Unique client identifier
  scope?: SyncScope;
  grocery_changes?: ChangeDelta<GroceryItem>[];
  grocery_list_changes?: ChangeDelta<GroceryList>[];
  grocery_list_member_changes?: ChangeDelta<GroceryListMember>[];
  store_changes?: ChangeDelta<Store>[];
  category_changes?: ChangeDelta<Category>[];
  grocery_item_store_info_changes?: ChangeDelta<GroceryItemStoreInfo>[];
}

export interface SyncResponse {
  server_timestamp: string; // ISO 8601 string from server
  success_ids: string[];
  upload_status: unknown[];
  remote_todo_list_changes?: ChangeDelta[];
  remote_todo_changes?: ChangeDelta[];
  remote_grocery_list_changes?: ChangeDelta<GroceryList>[];
  remote_grocery_list_member_changes?: ChangeDelta<GroceryListMember>[];
  remote_store_changes?: ChangeDelta<Store>[];
  remote_category_changes?: ChangeDelta<Category>[];
  remote_grocery_changes?: ChangeDelta<GroceryItem>[];
  remote_grocery_item_store_info_changes?: ChangeDelta<GroceryItemStoreInfo>[];
}
