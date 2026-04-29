import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAppStore } from '../store/useAppStore'
import { useAuth } from '../auth/useAuth'
import {
  ownerInfoQueryOptions,
  dependencyCountsQueryOptions,
  usageWindowsQueryOptions,
  extractServiceInfo,
} from '../api/triageSignals'
import { calcCreditsPerMonth } from '../utils/credits'
import type { ArcGISItem } from '../types/arcgis'

interface BasketPanelProps {
  items: ArcGISItem[]
}

export const BASKET_LIMIT = 25

function formatCreditsTotal(credits: number): string {
  if (credits < 0.01) return '< 0.01 credits/mo'
  if (credits >= 1000) return `${(credits / 1000).toFixed(1)}k credits/mo`
  return `${credits.toFixed(1)} credits/mo`
}

/** Floating tab rendered when the basket is minimised.
 *  Portalled to document.body so it sits above the calcite-shell stacking context. */
function MinimisedTab({
  count,
  onExpand,
}: {
  count: number
  onExpand: () => void
}) {
  return createPortal(
    <button
      type="button"
      aria-label={`Expand review basket — ${count} item${count === 1 ? '' : 's'}`}
      onClick={onExpand}
      style={{
        position: 'fixed',
        right: 0,
        top: '50%',
        // Translate up by 50% of own height to centre vertically, then rotate 180°
        // so the text reads bottom-to-top (pull-tab reads naturally when on right edge)
        transform: 'translateY(-50%) rotate(180deg)',
        zIndex: 9990,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        padding: '12px 8px',
        background: 'var(--calcite-color-brand)',
        color: '#fff',
        border: 'none',
        borderRadius: '6px 0 0 6px',
        cursor: 'pointer',
        fontFamily: 'var(--calcite-font-family, "Avenir Next", sans-serif)',
        fontSize: 11,
        fontWeight: 600,
        boxShadow: '-2px 0 8px rgba(0,0,0,0.18)',
        userSelect: 'none',
        writingMode: 'vertical-rl',
        textOrientation: 'mixed',
      }}
    >
      <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', letterSpacing: 1 }}>
        Basket ({count})
      </span>
    </button>,
    document.body
  )
}

export function BasketPanel({ items }: BasketPanelProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const { selectedIds, toggleSelectedId, orgId } = useAppStore()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const collapseActionRef = useRef<HTMLCalciteActionElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shellPanelRef = useRef<any>(null)

  // React does not serialise camelCase JSX props to kebab-case HTML attributes on
  // custom elements — displayMode="overlay" in JSX never reaches the DOM attribute.
  // Set it imperatively so Calcite picks it up after element upgrade.
  useEffect(() => {
    shellPanelRef.current?.setAttribute('display-mode', 'overlay')
  }, [])

  const selectedItems = selectedIds
    .map(id => items.find(i => i.id === id))
    .filter((i): i is ArcGISItem => i !== undefined)

  const missingCount = selectedIds.length - selectedItems.length
  const isFull = selectedIds.length >= BASKET_LIMIT

  const totalCredits = selectedItems.reduce(
    (sum, item) => sum + calcCreditsPerMonth(item.type, item.size),
    0
  )

  // Pre-warm signal queries as items enter the basket.
  // prefetchQuery is a no-op if the query is already cached or in-flight.
  useEffect(() => {
    if (!session) return
    for (const id of selectedIds) {
      const item = items.find(i => i.id === id)
      if (!item) continue
      queryClient.prefetchQuery(ownerInfoQueryOptions(item.owner, session))
      queryClient.prefetchQuery(dependencyCountsQueryOptions(item.id, session))
      if (orgId && extractServiceInfo(item.url)) {
        queryClient.prefetchQuery(usageWindowsQueryOptions(item.id, item.url, orgId, session))
      }
    }
  }, [selectedIds, items, session, orgId, queryClient])

  // Wire collapse action via ref — Calcite events inside shadow DOM are unreliable via JSX onClick.
  useEffect(() => {
    const el = collapseActionRef.current
    if (!el) return
    const handler = () => setIsCollapsed(true)
    el.addEventListener('click', handler)
    return () => el.removeEventListener('click', handler)
  }, [])

  // Auto-expand when new items are added while collapsed
  useEffect(() => {
    if (selectedIds.length > 0 && isCollapsed) {
      setIsCollapsed(false)
    }
    // Only react to count changes, not isCollapsed itself
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds.length])

  if (isCollapsed) {
    return <MinimisedTab count={selectedIds.length} onExpand={() => setIsCollapsed(false)} />
  }

  return (
    // displayMode="overlay" — panel sits on top of content without shifting layout.
    // "float" still reserves space in the shell grid; "overlay" does not.
    // display-mode must be set via setAttribute (see useEffect above) — React does not
    // serialise camelCase JSX props to kebab-case attributes on custom elements.
    <calcite-shell-panel ref={shellPanelRef} slot="panel-end" displayMode="overlay" position="end">
      <calcite-panel
        heading={`Review basket (${selectedIds.length})`}
        style={{ height: '100%', minWidth: '260px' } as React.CSSProperties}
      >
        {/* Minimise button in panel header */}
        <calcite-action
          ref={collapseActionRef}
          slot="header-actions-end"
          icon="minimize"
          text="Minimise basket"
          label="Minimise basket"
          scale="s"
        />

        <div style={{ padding: '0.5rem', overflowY: 'auto' }}>
          {isFull && (
            <calcite-notice kind="warning" open style={{ marginBottom: '0.5rem' }}>
              <span slot="message">
                Basket is full ({BASKET_LIMIT} items max). Remove an item to add another.
              </span>
            </calcite-notice>
          )}

          {selectedItems.map(item => (
            <div
              key={item.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 4px', borderBottom: '1px solid var(--calcite-color-border-3)',
              }}
            >
              <span style={{
                flex: 1, fontSize: 13,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {item.title}
              </span>
              <calcite-action
                icon="x"
                text="Remove"
                label="Remove from basket"
                scale="s"
                onClick={() => toggleSelectedId(item.id)}
              />
            </div>
          ))}

          {missingCount > 0 && (
            <p style={{ padding: '8px 4px', fontSize: 12, color: 'var(--calcite-color-text-3)' }}>
              {missingCount} item{missingCount === 1 ? '' : 's'} not in current view.
            </p>
          )}
        </div>

        {/* Credits subtotal — potential saving if all basket items are actioned */}
        <div style={{
          padding: '8px 12px',
          borderTop: '1px solid var(--calcite-color-border-2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 12,
          color: 'var(--calcite-color-text-2)',
          flexShrink: 0,
        }}>
          <span>Potential saving</span>
          <span style={{ fontWeight: 700, color: 'var(--calcite-color-text-1)' }}>
            {formatCreditsTotal(totalCredits)}
          </span>
        </div>

        <calcite-button
          slot="footer"
          width="full"
          onClick={() => navigate({ pathname: '/review', search: `?ids=${selectedIds.join(',')}` })}
        >
          Review these items →
        </calcite-button>
      </calcite-panel>
    </calcite-shell-panel>
  )
}
