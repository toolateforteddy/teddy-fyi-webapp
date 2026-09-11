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
  /**
   * An account invite: a signed credential naming one email address, which lets the server
   * create an account it would otherwise refuse.
   *
   * Absent on every ordinary sign-in. It only ever widens account creation, and only for the
   * address it names -- checked against the verified email on the Google token sent with it --
   * so a wrong or expired one is not an error in itself: the sign-in then succeeds or fails
   * exactly as it would have without it.
   */
  invite_code?: string
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

