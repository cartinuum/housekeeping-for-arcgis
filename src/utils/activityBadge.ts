import type { ArcGISItem } from '../types/arcgis'

export type ActivityTier = 'active' | 'recent' | 'quiet' | 'dormant'

export function classifyTier(item: ArcGISItem): ActivityTier {
  if (item.numViews === 0) return 'dormant'
  if (item.lastViewed == null) return 'dormant'
  const daysSince = (Date.now() - item.lastViewed) / 86_400_000
  if (daysSince <= 7) return 'active'
  if (daysSince <= 30) return 'recent'
  if (daysSince <= 365) return 'quiet'
  return 'dormant'
}

export function formatViewedText(item: ArcGISItem): string {
  if (item.numViews === 0) return 'Never viewed'
  if (item.lastViewed == null) return 'Viewed (date unknown)'
  const days = Math.floor((Date.now() - item.lastViewed) / 86_400_000)
  if (days < 1) return 'Viewed today'
  if (days === 1) return 'Viewed yesterday'
  if (days < 30) return `Viewed ${days} days ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `Viewed ${months} month${months === 1 ? '' : 's'} ago`
  const years = Math.floor(days / 365)
  return `Viewed ${years} year${years === 1 ? '' : 's'} ago`
}
