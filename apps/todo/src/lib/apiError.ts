/**
 * The message the API actually sent, or a fallback.
 *
 * The service serialises every failure as `{"error": "..."}` — one shape, from the single
 * `IntoResponse for AppError` in `src/routes/sync/types.rs`. Three call sites here read
 * `response.data.message` instead, a field that has never existed, so every one of them
 * silently fell through to its own generic string no matter what the server said.
 *
 * That is not cosmetic. `POST /api/lists/join` answers `403` for a bad code and `429`
 * once an account has failed five times in ten minutes, and the second one means *stop
 * typing, the next ten minutes cannot work*. Both surfaced as "Failed to join list. Please
 * check the code and try again." — which sent people back to re-read a code that was fine.
 */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: unknown } })?.response?.data

  if (typeof data === 'string' && data.trim()) return data.trim()

  if (data && typeof data === 'object') {
    // `error` first, because that is what this API sends. `message` is kept behind it so a
    // proxy or gateway error that uses the more common spelling is not swallowed.
    const record = data as Record<string, unknown>
    for (const key of ['error', 'message'] as const) {
      const value = record[key]
      if (typeof value === 'string' && value.trim()) return value.trim()
    }
  }

  return fallback
}

export default apiErrorMessage
