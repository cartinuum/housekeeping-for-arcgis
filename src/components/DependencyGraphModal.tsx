import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { ArcGISItem, DependencyCounts } from '../types/arcgis'
import type { WebMapDependencyMatch } from '../api/dependencyScanner'
import { useAppStore } from '../store/useAppStore'
import { DependencyGraph } from './DependencyGraph'

interface DependencyGraphModalProps {
  item: ArcGISItem
  counts: DependencyCounts
  webMapDeps?: WebMapDependencyMatch[]  // from JSON scan (shown as distinct blue nodes)
  onClose: () => void
}

export function DependencyGraphModal({ item, counts, webMapDeps, onClose }: DependencyGraphModalProps) {
  const { portalHostname } = useAppStore()
  const closeRef = useRef<HTMLCalciteActionElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', handler)
    // Attempt focus on close button after mount
    const focusTimer = setTimeout(() => {
      closeRef.current?.setFocus?.()
    }, 50)
    return () => {
      document.removeEventListener('keydown', handler)
      clearTimeout(focusTimer)
    }
  }, []) // empty — registers once, uses ref for latest onClose

  // Deduplicate for the count shown in the header (formal deps + web map scan)
  const uniqueIds = new Set([
    ...counts.upstreamItems.map(i => i.id),
    ...counts.downstreamItems.map(i => i.id),
    ...(webMapDeps ?? []).map(m => m.itemId),
  ])
  uniqueIds.delete(item.id) // exclude self-references
  const neighbourCount = uniqueIds.size

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Dependency graph — ${item.title}`}
        onClick={e => e.stopPropagation()}
        style={{
          width: '90vw',
          maxWidth: 1200,
          height: '85vh',
          maxHeight: 820,
          background: 'var(--calcite-color-foreground-1)',
          borderRadius: 8,
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: 'var(--calcite-font-family, "Avenir Next", sans-serif)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '10px 16px',
            borderBottom: '1px solid var(--calcite-color-border-2)',
            flexShrink: 0,
            gap: 8,
          }}
        >
          <span
            style={{
              fontWeight: 600,
              fontSize: 14,
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: 'var(--calcite-color-text-1)',
            }}
          >
            {item.title}
          </span>
          <span
            style={{
              fontSize: 11,
              color: 'var(--calcite-color-text-3)',
              whiteSpace: 'nowrap',
            }}
          >
            {neighbourCount} related {neighbourCount === 1 ? 'item' : 'items'}
          </span>
          <calcite-action
            ref={closeRef}
            icon="x"
            text="Close dependency graph"
            label="Close dependency graph"
            scale="s"
            onClick={onClose}
          />
        </div>

        {/* Legend */}
        <div
          style={{
            padding: '4px 16px',
            fontSize: 11,
            color: 'var(--calcite-color-text-3)',
            borderBottom: '1px solid var(--calcite-color-border-3)',
            flexShrink: 0,
          }}
        >
          ● Root item · ○ Related item · Click node to open · Drag to rearrange · Scroll to zoom
        </div>

        {/* Graph canvas */}
        <div style={{ flex: 1, minHeight: 0 }}>
          <DependencyGraph
            rootItem={item}
            counts={counts}
            webMapItems={(webMapDeps ?? []).map(m => ({ id: m.itemId, title: m.title, type: m.type }))}
            portalHostname={portalHostname}
          />
        </div>
      </div>
    </div>,
    document.body
  )
}
