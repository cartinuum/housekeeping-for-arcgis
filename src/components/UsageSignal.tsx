import { useMemo } from 'react'
import type { ArcGISItem, UsageWindows } from '../types/arcgis'
import { classifyUsageWindows, validateLastViewed } from '../utils/usageSignal'

// ─── Fallback (basic tier, no API data) ──────────────────────────────────────

// Used when usage windows are unavailable (admin org scope, error, etc.)
// Mirrors ActivityBadge logic but condensed.
function classifyBasicTier(item: ArcGISItem): { dot: string; dotColour: string; badge: { bg: string; fg: string }; message: string } {
  const { numViews } = item
  const lastViewed = item.lastViewed ?? null

  if (numViews === 0 || lastViewed === null) {
    return { dot: '✕', dotColour: '#dc3545', badge: { bg: '#f8d7da', fg: '#721c24' }, message: 'Never viewed' }
  }
  const days = (Date.now() - lastViewed) / 86_400_000
  if (days <= 7)   return { dot: '●', dotColour: '#155724', badge: { bg: '#d4edda', fg: '#155724' }, message: 'Viewed recently' }
  if (days <= 30)  return { dot: '●', dotColour: '#004085', badge: { bg: '#cce5ff', fg: '#004085' }, message: 'Viewed this month' }
  if (days <= 365) return { dot: '◐', dotColour: '#856404', badge: { bg: '#fff3cd', fg: '#856404' }, message: 'Low usage' }
  return { dot: '✕', dotColour: '#dc3545', badge: { bg: '#f8d7da', fg: '#721c24' }, message: 'Not viewed in over a year' }
}

function formatLastViewedText(lastViewed: number): string {
  const days = Math.floor((Date.now() - lastViewed) / 86_400_000)
  if (days < 1) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days} days ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`
  const years = Math.floor(days / 365)
  return `${years} year${years === 1 ? '' : 's'} ago`
}

function formatViewCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
}

// ─── Components ───────────────────────────────────────────────────────────────

interface UsageSignalProps {
  item: ArcGISItem
  windows: UsageWindows | null | undefined
  isLoading?: boolean
  isError?: boolean
}

export function UsageSignal({ item, windows, isLoading, isError }: UsageSignalProps) {
  const classification = useMemo(
    () => (windows ? classifyUsageWindows(windows.views30d, windows.views60d) : null),
    [windows]
  )

  const validLastViewed = useMemo(
    () => windows ? validateLastViewed(windows.views30d, item.lastViewed ?? null) : null,
    [windows, item.lastViewed]
  )

  // Stable element ID for tooltip anchor — keyed to item so multiple strips don't collide
  const tooltipId = `usage-info-${item.id}`

  // API data available — show calcite-notice traffic-light
  if (classification && windows) {
    return (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <calcite-notice kind={classification.kind as any} open style={{ width: '100%' }}>
        <div slot="message">
          <div style={{ fontWeight: 600, marginBottom: 2, fontSize: 12 }}>
            {classification.message}
          </div>
          <div style={{ fontSize: 11, opacity: 0.9, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <span>Last 30 days: <strong>{windows.views30d.toLocaleString()}</strong></span>
            <span style={{ opacity: 0.5 }}>·</span>
            <span>Last 60 days: <strong>{windows.views60d.toLocaleString()}</strong></span>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <calcite-icon id={tooltipId} icon={'information' as any} scale="s" style={{ opacity: 0.5, cursor: 'default', flexShrink: 0 } as React.CSSProperties} />
            <calcite-tooltip referenceElement={tooltipId} placement="top">
              API requests to this service in the last 30 and 60 days.
              Counts direct calls from maps, apps, and other ArcGIS services —
              not portal page views. Only available for Feature, Map, Image, Scene,
              and Vector Tile services.
            </calcite-tooltip>
          </div>
          {validLastViewed && (
            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>
              Last viewed: {formatLastViewedText(validLastViewed)}
            </div>
          )}
        </div>
      </calcite-notice>
    )
  }

  // Loading: service query in flight — show a neutral placeholder matching the notice footprint
  if (isLoading) {
    return (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <calcite-notice kind={'neutral' as any} open style={{ width: '100%', opacity: 0.6 }}>
        <div slot="message" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <calcite-loader scale="s" inline label="Loading usage data" />
          <span style={{ fontSize: 11 }}>Loading 30/60-day usage…</span>
        </div>
      </calcite-notice>
    )
  }

  // No service URL (Web Map, Dashboard, App, etc.) or error — fall back to basic all-time tier
  const basic = classifyBasicTier(item)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap' }}>
      <span style={{
        background: basic.badge.bg,
        color: basic.badge.fg,
        borderRadius: 4,
        padding: '1px 7px',
        fontSize: 11,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}>
        <span aria-hidden="true" style={{ color: basic.dotColour }}>{basic.dot}</span>
        {basic.message}
      </span>
      <span style={{ fontSize: 11, color: 'var(--calcite-color-text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {formatViewCount(item.numViews)} views · all-time
        {item.lastViewed ? ` · ${formatLastViewedText(item.lastViewed)}` : ''}
        {isError && <> · <span style={{ fontStyle: 'italic' }}>service usage unavailable</span></>}
      </span>
    </div>
  )
}
