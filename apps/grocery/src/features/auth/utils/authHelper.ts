/**
 * Decodes a Google ID token (JWT) to extract the sub (user ID) claim.
 */
export function getUserIdFromToken(token: string): string {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    const decoded = JSON.parse(jsonPayload)
    return decoded.sub || ''
  } catch (error) {
    console.error('Failed to parse Google ID token:', error)
    return ''
  }
}

export { getClientUuid } from '@/utils/uuid'
