import { createContext, useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { storage } from '@/utils/storage'
import { STORAGE_KEYS } from '@/config/storageKeys'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { applyTheme } from '../applyTheme'
import { isThemePreference } from '../theme'
import type { ResolvedTheme, ThemePreference } from '../theme'

export interface ThemeContextType {
  /** What the user chose: 'system', 'light' or 'dark'. */
  preference: ThemePreference
  /** What that resolves to right now. */
  resolved: ResolvedTheme
  setPreference: (preference: ThemePreference) => void
}

// eslint-disable-next-line react-refresh/only-export-components
export const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

interface ThemeProviderProps {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => {
    const stored = storage.getItem<unknown>(STORAGE_KEYS.THEME, 'system')
    return isThemePreference(stored) ? stored : 'system'
  })

  // Asking for *light* rather than dark on purpose. This app was dark for its
  // whole life, so dark is what anything that cannot answer the question -- an
  // old browser, jsdom, a headless renderer -- should get.
  const prefersLight = useMediaQuery('(prefers-color-scheme: light)')

  const resolved: ResolvedTheme =
    preference === 'system' ? (prefersLight ? 'light' : 'dark') : preference

  // index.html has already applied the same answer before first paint; this
  // keeps it true as the preference or the OS setting changes underneath.
  useEffect(() => {
    applyTheme(resolved)
  }, [resolved])

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next)
    storage.setItem(STORAGE_KEYS.THEME, next)
  }, [])

  return (
    <ThemeContext.Provider value={{ preference, resolved, setPreference }}>
      {children}
    </ThemeContext.Provider>
  )
}
