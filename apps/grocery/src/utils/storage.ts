export const storage = {
  /**
   * Retrieves an item from localStorage, parsing it as JSON.
   * If parsing fails or the key is not present, it returns the fallback value.
   */
  getItem<T>(key: string, fallback: T): T {
    try {
      const value = localStorage.getItem(key)
      if (value === null) return fallback
      try {
        return JSON.parse(value) as T
      } catch {
        // Fallback for plain strings that aren't JSON-formatted
        return value as unknown as T
      }
    } catch (error) {
      console.error(`Error reading key "${key}" from localStorage:`, error)
      return fallback
    }
  },

  /**
   * Stores an item in localStorage, stringifying object types.
   */
  setItem<T>(key: string, value: T): void {
    try {
      const stringified = typeof value === 'string' ? value : JSON.stringify(value)
      localStorage.setItem(key, stringified)
    } catch (error) {
      console.error(`Error writing key "${key}" to localStorage:`, error)
    }
  },

  /**
   * Removes an item from localStorage.
   */
  removeItem(key: string): void {
    try {
      localStorage.removeItem(key)
    } catch (error) {
      console.error(`Error removing key "${key}" from localStorage:`, error)
    }
  },

  /**
   * Clears all items from localStorage.
   */
  clear(): void {
    try {
      localStorage.clear()
    } catch (error) {
      console.error('Error clearing localStorage:', error)
    }
  }
}
