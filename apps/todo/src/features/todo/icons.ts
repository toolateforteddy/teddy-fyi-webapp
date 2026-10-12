/**
 * Task icons: the fixed set of Material icon names the server's AI picks from
 * (`TODO_ICONS` in `teddy-fyi-api-rust/src/routes/ai/service.rs`) and Android draws
 * (`IconUtils.kt`). Stored by their Compose names; drawn here as Material Symbols ligatures.
 */
export const TODO_ICONS = [
  'Build', 'Home', 'Plumbing', 'ElectricalServices', 'CleaningServices', 'Brush', 'Yard', 'Work',
  'AttachMoney', 'CreditCard', 'ReceiptLong', 'Email', 'Phone', 'Analytics', 'ShoppingCart',
  'LocalShipping', 'DirectionsCar', 'Storefront', 'LocalPharmacy', 'FitnessCenter', 'DirectionsBike',
  'DirectionsRun', 'MedicalInformation', 'Restaurant', 'Bed', 'Event', 'Schedule', 'List', 'Group',
  'Person', 'Settings', 'Computer', 'MenuBook', 'Movie', 'Palette', 'MusicNote', 'Pets', 'Flight',
  'Eco', 'Lock',
] as const

const KNOWN = new Set<string>(TODO_ICONS)

/**
 * The ligature for a stored name, or null for one this app does not know. Matched as Android
 * matches: exactly, then with the first letter upper-cased.
 */
export function iconLigature(name: string | null | undefined): string | null {
  if (!name) return null
  const resolved = KNOWN.has(name) ? name : name.charAt(0).toUpperCase() + name.slice(1)
  if (!KNOWN.has(resolved)) return null
  return resolved.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase()
}
