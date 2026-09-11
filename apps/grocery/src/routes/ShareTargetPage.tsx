import { Navigate, useSearchParams } from 'react-router-dom'
import { parseSharedItem, stashSharedItem } from '@/features/grocery/utils/sharedItem'

/**
 * Where the OS share sheet lands: manifest `share_target` points here.
 *
 * It renders nothing. It parks the shared text (see sharedItem.ts for why
 * localStorage rather than router state) and sends the user to the list, which
 * opens the add-item sheet with the name filled in. Public on purpose -- sharing
 * into a signed-out app should reach the login page and still have the item
 * waiting on the other side.
 */
export function ShareTargetPage() {
  const [params] = useSearchParams()

  const name = parseSharedItem(params)
  if (name) stashSharedItem(name)

  return <Navigate to="/" replace />
}

export default ShareTargetPage
