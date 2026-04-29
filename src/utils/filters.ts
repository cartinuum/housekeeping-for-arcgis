import { calcCreditsPerMonth } from './credits'
import type { ArcGISItem } from '../types/arcgis'
import type { Filters } from '../store/useAppStore'

export function applyFilters(items: ArcGISItem[], filters: Filters): ArcGISItem[] {
  let result = items
  if (filters.types.length > 0) {
    result = result.filter(i => filters.types.includes(i.type))
  }
  if (filters.minSizeBytes !== null) {
    // size === -1 means the API didn't report a file size (common for hosted services).
    // Treat unknown size as "not small" — don't exclude these items from the min filter.
    result = result.filter(i => i.size < 0 || i.size >= filters.minSizeBytes!)
  }
  if (filters.maxSizeBytes !== null) {
    // Unknown-size items pass the max filter too — we can't reliably exclude them.
    result = result.filter(i => i.size < 0 || i.size <= filters.maxSizeBytes!)
  }
  if (filters.modifiedDaysAgo !== null) {
    const cutoff = Date.now() - filters.modifiedDaysAgo * 86_400_000
    result = result.filter(i => i.modified < cutoff)
  }
  if (filters.minCredits !== null && filters.minCredits > 0) {
    result = result.filter(i => calcCreditsPerMonth(i.type, i.size) >= filters.minCredits!)
  }
  if (filters.maxCredits !== null) {
    result = result.filter(i => calcCreditsPerMonth(i.type, i.size) <= filters.maxCredits!)
  }
  return result
}
