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

export function getCategoryColor(categoryId: number): string {
  if (CATEGORY_COLORS[categoryId]) return CATEGORY_COLORS[categoryId]
  const colors = Object.values(CATEGORY_COLORS)
  // Ensure we don't try to access an empty colors array
  if (colors.length === 0) return '#737373'
  return colors[Math.abs(categoryId) % colors.length]
}

export const DEFAULT_RECOMMENDATIONS: { name: string; categoryId: number; storeId: number; timesBought: number }[] = []

