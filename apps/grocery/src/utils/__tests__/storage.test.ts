import { describe, it, expect, vi } from 'vitest'
import { storage } from '../storage'

describe('storage utility', () => {
  it('should store and retrieve string values', () => {
    storage.setItem('test-key', 'hello-world')
    const value = storage.getItem('test-key', 'fallback')
    expect(value).toBe('hello-world')
  })

  it('should store and retrieve object values', () => {
    const data = { id: 1, name: 'Apple', active: true }
    storage.setItem('grocery-item', data)
    const value = storage.getItem('grocery-item', null)
    expect(value).toEqual(data)
  })

  it('should return fallback when key does not exist', () => {
    const value = storage.getItem('non-existent', 'fallback-value')
    expect(value).toBe('fallback-value')
  })

  it('should fall back to raw string when JSON parsing fails', () => {
    localStorage.setItem('bad-json', '{invalid-json')
    const value = storage.getItem('bad-json', 'fallback')
    expect(value).toBe('{invalid-json')
  })

  it('should remove item', () => {
    storage.setItem('temp-key', 'temp-value')
    expect(storage.getItem('temp-key', '')).toBe('temp-value')
    
    storage.removeItem('temp-key')
    expect(storage.getItem('temp-key', 'fallback')).toBe('fallback')
  })

  it('should clear all items', () => {
    storage.setItem('key1', 'val1')
    storage.setItem('key2', 'val2')
    
    storage.clear()
    
    expect(storage.getItem('key1', null)).toBeNull()
    expect(storage.getItem('key2', null)).toBeNull()
  })

  it('should handle errors gracefully and return fallback on error', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const getItemSpy = vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('Storage disabled')
    })

    const value = storage.getItem('error-key', 'fallback')
    expect(value).toBe('fallback')
    expect(consoleSpy).toHaveBeenCalled()

    getItemSpy.mockRestore()
    consoleSpy.mockRestore()
  })
})
