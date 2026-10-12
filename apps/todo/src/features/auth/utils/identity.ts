import type { User } from '../types'

/**
 * The id this account's synced rows are keyed by.
 *
 * A person has two names on the server and which one is correct depends on the table.
 * `users.id`, `sessions` and therefore everything the auth endpoints take or return in a
 * `user_id` field are the raw Google subject. Every row either product owns -- the grocery
 * items, lists, list members, stores and categories this app syncs -- is keyed by
 * `users.surrogate_id`, an opaque UUID the server hands back as `user_uuid` on `/auth/login`
 * and `/auth/refresh`.
 *
 * So: `user.id` for anything the auth endpoints ask for, this function for anything that
 * ends up in a sync payload. Getting it the wrong way round is not a soft failure -- the
 * server refuses a membership row whose `user_id` is not the surrogate rather than
 * translating it, and that refusal fails the whole sync batch.
 *
 * Falls back to the subject when the server did not send a surrogate, which means a server
 * older than the re-key -- and there the subject is exactly what those rows are keyed by.
 */
export function rowUserId(user: User | null | undefined): string | undefined {
  return user?.surrogateId || user?.id
}

/**
 * The id local rows may still be stamped with from before the re-key, or `undefined` if
 * there is nothing to migrate.
 *
 * Only meaningful once the surrogate is known: until then the subject is not stale, it is
 * simply the current answer.
 */
export function legacyRowUserId(user: User | null | undefined): string | undefined {
  if (!user?.surrogateId) return undefined
  return user.id && user.id !== user.surrogateId ? user.id : undefined
}
