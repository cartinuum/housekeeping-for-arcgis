import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { useAuth } from '../auth/useAuth'
import { calcCreditsPerMonth } from '../utils/credits'
import { TriageStrip } from './TriageStrip'
import type { ArcGISItem } from '../types/arcgis'

interface ReviewPanelProps {
  items: ArcGISItem[]
}

export function ReviewPanel({ items }: ReviewPanelProps) {
  const navigate = useNavigate()
  const { session } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const { selectedIds, setSelectedIds, setReasonMap: saveReasonMap, isAdmin } = useAppStore()
  const [hydrated, setHydrated] = useState(false)
  const [reasonMap, setReasonMap] = useState<Record<string, string>>({})

  // Hydrate basket from URL on cold start at /#/review?ids=a,b,c
  // Sets `hydrated` state so the write-back effect knows it's safe to run.
  useEffect(() => {
    const raw = searchParams.get('ids')
    if (raw) {
      const ids = raw.split(',').filter(Boolean)
      if (ids.length > 0) setSelectedIds(ids)
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Write basket back to URL (debounced 300ms). Gated on hydrated to prevent
  // the initial empty selectedIds wiping the URL before hydration completes.
  useEffect(() => {
    if (!hydrated) return
    const timer = setTimeout(() => {
      if (selectedIds.length > 0) {
        setSearchParams({ ids: selectedIds.join(',') }, { replace: true })
      } else {
        setSearchParams({}, { replace: true })
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [selectedIds, setSearchParams, hydrated])

  if (!session) return null

  // Resolve selected items from full items array and sort by credits/mo desc
  const selectedItems = selectedIds
    .map(id => items.find(i => i.id === id))
    .filter((i): i is ArcGISItem => i !== undefined)

  const sorted = [...selectedItems].sort((a, b) =>
    calcCreditsPerMonth(b.type, b.size) - calcCreditsPerMonth(a.type, a.size)
  )

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* ── Sticky header ── */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--calcite-color-border-1)',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexShrink: 0,
      }}>
        <calcite-button
          appearance="transparent"
          icon-start="arrow-left"
          onClick={() => navigate('/')}
        >
          Back to inventory · {selectedIds.length} item{selectedIds.length === 1 ? '' : 's'} selected
        </calcite-button>
        <h2 style={{
          margin: 0,
          fontSize: 16,
          fontWeight: 600,
          color: 'var(--calcite-color-text-1)',
        }}>
          Review ({sorted.length} item{sorted.length === 1 ? '' : 's'})
        </h2>
      </div>

      {/* Safety note — makes clear that the − button removes from list, not from ArcGIS Online.
          Shown once at the top so users aren't surprised by the per-strip remove action. */}
      <div style={{
        padding: '8px 16px',
        fontSize: 11,
        color: 'var(--calcite-color-text-3)',
        background: 'var(--calcite-color-foreground-2)',
        borderBottom: '1px solid var(--calcite-color-border-3)',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <calcite-icon icon={'information' as any} scale="s" style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, lineHeight: 1.5 }}>
          <div style={{ marginBottom: 4 }}>
            Removing an item from this list does not delete it from ArcGIS Online.
          </div>
          <div>
            Dependency counts may be incomplete. Web Maps and Scenes are scanned directly, but private items you can't access won't appear.
          </div>
        </div>
      </div>

      {/* ── Scrollable strip list ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {sorted.length === 0 && (
          <div style={{ padding: '2rem', color: 'var(--calcite-color-text-3)' }}>
            No items in basket. Go back to inventory and select items to review.
          </div>
        )}
        {sorted.map(item => (
          <TriageStrip
            key={item.id}
            item={item}
            session={session}
            reason={isAdmin ? reasonMap[item.id] : undefined}
            onReasonChange={isAdmin
              ? (r) => setReasonMap(prev => ({ ...prev, [item.id]: r }))
              : undefined
            }
          />
        ))}
      </div>

      {/* ── Sticky footer ── */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid var(--calcite-color-border-1)',
        flexShrink: 0,
      }}>
        {isAdmin ? (
          <calcite-button
            width="full"
            disabled={selectedIds.length === 0 || undefined}
            onClick={() => {
              saveReasonMap(reasonMap)
              navigate({
                pathname: '/action',
                search: `?ids=${selectedIds.join(',')}`,
              })
            }}
          >
            Notify owners →
          </calcite-button>
        ) : (
          <calcite-button
            width="full"
            onClick={() => navigate('/')}
          >
            Done reviewing
          </calcite-button>
        )}
      </div>
    </div>
  )
}
