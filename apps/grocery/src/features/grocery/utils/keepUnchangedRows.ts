/**
 * The collection a sync leaves behind, or `prev` itself when the sync changed nothing in it.
 *
 * A sync with nothing to say for a table used to hand back a freshly normalised, freshly
 * sorted copy of every row anyway, and a new array is a change as far as React is
 * concerned: every screen re-rendered, every tile got a new `item` and could not skip, and
 * `usePersistentState` rewrote the whole collection to storage -- six times per sync, for
 * nothing. Rows the merge did not touch come back as the same objects, so identity is
 * enough to tell; only the rows it did touch are normalised again, so an edit that arrives
 * from another device re-renders its own tile and leaves the rest alone.
 */
export function keepUnchangedRows<T>(
  prev: T[],
  merged: T[],
  normalizer: (row: any) => T,
  sorter: (rows: T[]) => T[]
): T[] {
  if (merged.length === prev.length && merged.every((row, i) => row === prev[i])) return prev
  const untouched = new Set(prev)
  return sorter(merged.map(row => (untouched.has(row) ? row : normalizer(row))))
}
