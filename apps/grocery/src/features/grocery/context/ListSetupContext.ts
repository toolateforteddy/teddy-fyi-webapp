import { createContext, useContext } from 'react'

/**
 * Opens the list setup sheet for the active list, from anywhere under the shell.
 *
 * Null outside DashboardLayout -- a screen rendered on its own, as in a test,
 * simply has no way in and should hide the button that would use it.
 */
export const ListSetupContext = createContext<(() => void) | null>(null)

export const useOpenListSetup = () => useContext(ListSetupContext)
