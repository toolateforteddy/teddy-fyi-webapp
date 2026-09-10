export interface User {
  /**
   * The raw Google subject. This is what `/auth/login` and `/auth/refresh` take and return
   * in their `user_id` fields, and it is *not* the id synced rows are keyed by -- see
   * `surrogateId` and `rowUserId` in `../utils/identity`.
   */
  id: string
  /**
   * `users.surrogate_id`, the opaque id every grocery row is keyed by, learnt from the
   * `user_uuid` field on the login and refresh responses.
   *
   * Optional because the field is: a server older than the surrogate re-key omits it, and
   * there the subject above is still the right key.
   */
  surrogateId?: string
  email: string
  name?: string
  picture?: string
}

export interface AuthState {
  isAuthenticated: boolean
  user: User | null
  isLoading: boolean
}

export interface LoginRequest {
  user_id: string
  client_uuid: string
  google_auth_token: string
  use_cookie?: boolean
}

export interface LoginResponse {
  /** The raw Google subject. */
  user_id: string
  email: string | null
  refresh_token: string
  /** The account's surrogate id; absent from servers older than the re-key. */
  user_uuid?: string | null
}

export interface RefreshRequest {
  user_id: string
  client_uuid: string
  refresh_token: string
  use_cookie?: boolean
}

export interface RefreshResponse {
  refresh_token: string
  /** The account's surrogate id; absent from servers older than the re-key. */
  user_uuid?: string | null
}

