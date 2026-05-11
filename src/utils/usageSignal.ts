export type UsageTier = 'critical' | 'warning' | 'active'

export interface UsageClassification {
  tier: UsageTier
  kind: 'danger' | 'warning' | 'success'
  message: string
}

/**
 * Classify usage pattern from 30D and 60D window counts into a traffic-light tier.
 *
 * - critical/danger:  0 views in 30D and ≤ 10 in 60D → deletion candidate
 * - warning:          0 views in 30D, or ≤ 10 in 30D → review recommended
 * - active/success:   > 10 views in 30D
 */
export function classifyUsageWindows(views30d: number, views60d: number): UsageClassification {
  if (views30d === 0 && views60d <= 10) {
    return { tier: 'critical', kind: 'danger', message: 'No recent usage · Deletion candidate' }
  }
  if (views30d === 0 || views30d <= 10) {
    return { tier: 'warning', kind: 'warning', message: 'Low usage · Review recommended' }
  }
  return { tier: 'active', kind: 'success', message: 'Active usage' }
}

/**
 * Omit lastViewed if it contradicts the 30D window data.
 * ArcGIS Online's lastViewed and portal usage stats come from different systems
 * and can diverge. Showing inconsistent values confuses triage decisions.
 */
export function validateLastViewed(
  views30d: number,
  lastViewed: number | null | undefined
): number | null {
  if (!lastViewed) return null
  const daysSince = (Date.now() - lastViewed) / 86_400_000
  // No portal views in 30D but lastViewed < 30 days ago → inconsistent, omit
  if (views30d === 0 && daysSince < 30) return null
  // Views in 30D but lastViewed > 30 days ago → inconsistent, omit
  if (views30d > 0 && daysSince > 30) return null
  return lastViewed
}
