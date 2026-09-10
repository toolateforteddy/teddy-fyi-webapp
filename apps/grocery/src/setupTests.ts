import '@testing-library/jest-dom'
import { beforeEach } from 'vitest'

// Mock document.startViewTransition
if (typeof window !== 'undefined') {
  window.document.startViewTransition = (cb: () => void) => {
    cb()
    return {
      finished: Promise.resolve(),
      ready: Promise.resolve(),
      updateCallbackDone: Promise.resolve(),
      skipTransition: () => {}
    } as any
  }
}

// Mock HTMLDialogElement support in jsdom
if (typeof window !== 'undefined') {
  HTMLDialogElement.prototype.showModal = function(this: HTMLDialogElement) {
    this.setAttribute('open', '')
    this.dispatchEvent(new Event('show'))
  }
  HTMLDialogElement.prototype.close = function(this: HTMLDialogElement) {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
}

// Mock localStorage in-memory for tests
if (typeof window !== 'undefined') {
  let store: Record<string, string> = {}
  const localStorageMock = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = String(value)
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
    key: (index: number) => Object.keys(store)[index] || null,
    get length() {
      return Object.keys(store).length
    }
  }
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true
  })
}

// Automatically clear localStorage before each test run
beforeEach(() => {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.clear()
  }
})
