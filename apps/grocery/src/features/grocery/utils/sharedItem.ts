import { storage } from '@/utils/storage'

/**
 * The hand-off between a Web Share Target hit and the add-item sheet.
 *
 * The share lands on `/share` as a GET, which is a *public* route, and the list
 * behind it is not: an unauthenticated share would otherwise bounce to /login and
 * take the shared text with it. So the text is parked in localStorage and the
 * route redirects to "/" -- which survives the login round trip, and survives a
 * reload, and needs no router state threaded through AuthenticatedRoute.
 *
 * It is a one-shot: whoever reads it clears it, so a later reload does not reopen
 * the sheet with something the user already added. Reading and clearing are two
 * calls rather than one because the reader is a React component: it reads while
 * rendering, where a side effect does not belong, and clears from an effect.
 */
const SHARED_ITEM_KEY = 'grocery_shared_item'

/** Item names are short; anything past this is a pasted article, not groceries. */
const MAX_NAME_LENGTH = 120

/**
 * What to call the thing that was shared.
 *
 * Share sheets disagree about which field carries the useful part: sharing a page
 * gives a `title` and a `url`, sharing plain text from a notes app gives only
 * `text`, and some apps append the URL to the text. Title first, then the first
 * line of the text, then the bare URL as a last resort -- a name is better than an
 * empty sheet, even a bad one, because the user is about to edit it anyway.
 */
export function parseSharedItem(params: URLSearchParams): string | null {
  const candidates = [params.get('title'), params.get('text'), params.get('url')]

  for (const candidate of candidates) {
    const firstLine = (candidate || '').split('\n')[0].trim()
    if (firstLine) return firstLine.slice(0, MAX_NAME_LENGTH)
  }

  return null
}

export function stashSharedItem(name: string): void {
  storage.setItem(SHARED_ITEM_KEY, name)
}

/** What was shared, if anything. Safe to call repeatedly; changes nothing. */
export function peekSharedItem(): string | null {
  const name = storage.getItem<string | null>(SHARED_ITEM_KEY, null)
  return typeof name === 'string' && name.trim() ? name : null
}

export function clearSharedItem(): void {
  storage.removeItem(SHARED_ITEM_KEY)
}
