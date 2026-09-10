import type { Store, Category } from '@/types/grocery'

export const DEFAULT_STORES: Store[] = []

export const DEFAULT_CATEGORIES: Category[] = []

export const CATEGORY_COLORS: Record<number, string> = {
  1: '#8ADEAD',      // Produce
  2: '#FFD97D',      // Dairy & Eggs
  3: '#FF9B85',      // Bakery
  4: '#90E0EF',      // Pantry
  5: '#EE6C4D',      // Meat & Seafood
  6: '#C18C5D',      // Frozen
}

export function getCategoryColor(categoryId: string | number | undefined): string {
  if (!categoryId) return '#737373'
  
  if (typeof categoryId === 'number') {
    if (CATEGORY_COLORS[categoryId]) return CATEGORY_COLORS[categoryId]
    const colors = Object.values(CATEGORY_COLORS)
    if (colors.length === 0) return '#737373'
    return colors[Math.abs(categoryId) % colors.length]
  }

  const parsedInt = parseInt(String(categoryId), 10)
  if (!isNaN(parsedInt) && String(parsedInt) === String(categoryId)) {
    if (CATEGORY_COLORS[parsedInt]) return CATEGORY_COLORS[parsedInt]
  }

  let hash = 0
  const str = String(categoryId)
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const colors = Object.values(CATEGORY_COLORS)
  if (colors.length === 0) return '#737373'
  return colors[Math.abs(hash) % colors.length]
}

export const DEFAULT_RECOMMENDATIONS: { name: string; categoryId: string; storeId: string; timesBought: number }[] = []

