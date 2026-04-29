import type { ArcGISItem } from '../types/arcgis'
import { type ActivityTier, classifyTier, formatViewedText } from '../utils/activityBadge'

interface TierConfig {
  label: string
  dot: string
  badge: { background: string; color: string }
  barColor: string
  segment: 0 | 1 | 2 | 3
}

const TIER_CONFIG: Record<ActivityTier, TierConfig> = {
  active:  { label: 'Active',  dot: '●', badge: { background: '#d4edda', color: '#155724' }, barColor: '#28a745', segment: 0 },
  recent:  { label: 'Recent',  dot: '●', badge: { background: '#cce5ff', color: '#004085' }, barColor: '#0079c1', segment: 1 },
  quiet:   { label: 'Quiet',   dot: '◐', badge: { background: '#fff3cd', color: '#856404' }, barColor: '#ffc107', segment: 2 },
  dormant: { label: 'Dormant', dot: '✗', badge: { background: '#f8d7da', color: '#721c24' }, barColor: '#dc3545', segment: 3 },
}

const SEGMENT_TITLES = ['Within 7 days', 'Within 30 days', 'Within 1 year', 'Older than 1 year']

interface ActivityBadgeProps {
  item: ArcGISItem
}

export function ActivityBadge({ item }: ActivityBadgeProps) {
  const tier = classifyTier(item)
  const cfg = TIER_CONFIG[tier]

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap' }}>
      {/* Tier badge pill */}
      <span style={{
        background: cfg.badge.background,
        color: cfg.badge.color,
        borderRadius: 4,
        padding: '1px 7px',
        fontSize: 11,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}>
        {cfg.dot} {cfg.label}
      </span>

      {/* Views + last viewed text */}
      <span style={{
        fontSize: 11,
        color: 'var(--calcite-color-text-3)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {item.numViews.toLocaleString()} views · {formatViewedText(item)}
      </span>

      {/* 4-segment staleness bar */}
      <div style={{ display: 'flex', gap: 2, flexShrink: 0 }} aria-hidden="true">
        {SEGMENT_TITLES.map((title, i) => (
          <div
            key={i}
            title={title}
            style={{
              width: 14,
              height: 4,
              borderRadius: i === 0 ? '3px 0 0 3px' : i === 3 ? '0 3px 3px 0' : 0,
              background: i === cfg.segment ? cfg.barColor : 'var(--calcite-color-border-2)',
              transition: 'background 0.15s',
            }}
          />
        ))}
      </div>
    </div>
  )
}
