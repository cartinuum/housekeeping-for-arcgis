import { useState, useRef, useEffect, useCallback } from 'react'
import type { ArcGISItem } from '../types/arcgis'
import { calcCreditsPerMonth } from '../utils/credits'
import { formatBytes } from '../utils/format'
import { buildItemUrl } from '../utils/portalUrl'
import { useAppStore } from '../store/useAppStore'
import { BASKET_LIMIT } from './BasketPanel'

type SortCol = 'title' | 'type' | 'credits' | 'size' | 'views' | 'modified'
type SortDir = 'asc' | 'desc'

interface TableViewProps {
  items: ArcGISItem[]
  /** Stable colour map from Dashboard — drives coloured type badges in the Type column */
  typeColourMap?: Map<string, string>
}

function formatDate(epochMs: number): string {
  return new Intl.DateTimeFormat('en-AU', {
    year: 'numeric', month: 'short', day: 'numeric',
  }).format(new Date(epochMs))
}

function sortItems(items: ArcGISItem[], col: SortCol, dir: SortDir): ArcGISItem[] {
  return [...items].sort((a, b) => {
    let av: number | string
    let bv: number | string
    switch (col) {
      case 'credits':  av = calcCreditsPerMonth(a.type, a.size); bv = calcCreditsPerMonth(b.type, b.size); break
      case 'size':     av = a.size;        bv = b.size;        break
      case 'views':    av = a.numViews;    bv = b.numViews;    break
      case 'modified': av = a.modified;    bv = b.modified;    break
      case 'title':    av = a.title.toLowerCase();  bv = b.title.toLowerCase();  break
      case 'type':     av = a.type.toLowerCase();   bv = b.type.toLowerCase();   break
    }
    if (av < bv) return dir === 'asc' ? -1 : 1
    if (av > bv) return dir === 'asc' ? 1 : -1
    return 0
  })
}

interface SortableHeaderProps {
  heading: string
  col: SortCol
  sortCol: SortCol
  sortDir: SortDir
  onSort: (col: SortCol) => void
}

function SortableHeader({ heading, col, sortCol, sortDir, onSort }: SortableHeaderProps) {
  const ref = useRef<HTMLCalciteTableHeaderElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const handler = () => onSort(col)
    el.addEventListener('click', handler)
    return () => el.removeEventListener('click', handler)
  }, [col, onSort])

  const indicator = col === sortCol ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕'

  return (
    <calcite-table-header
      ref={ref}
      heading={heading + indicator}
      style={{ cursor: 'pointer' }}
    />
  )
}

export function TableView({ items, typeColourMap }: TableViewProps) {
  const [sortCol, setSortCol] = useState<SortCol>('credits')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const { selectedIds, toggleSelectedId, portalHostname } = useAppStore()

  const handleSort = useCallback((col: SortCol) => {
    setSortCol(prev => {
      if (prev === col) {
        setSortDir(d => d === 'asc' ? 'desc' : 'asc')
        return col
      }
      setSortDir('desc')
      return col
    })
  }, [])

  const sorted = sortItems(items, sortCol, sortDir)
  const basketFull = selectedIds.length >= BASKET_LIMIT

  return (
    <div style={{ overflow: 'auto', height: '100%' }}>
      <calcite-table caption="Content items" striped>
        <calcite-table-row slot="table-header">
          <calcite-table-header heading="" style={{ width: '36px' }} />
          <SortableHeader heading="Title"      col="title"    sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
          <SortableHeader heading="Type"       col="type"     sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
          <SortableHeader heading="Credits/mo" col="credits"  sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
          <SortableHeader heading="Size"       col="size"     sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
          <SortableHeader heading="Views"      col="views"    sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
          <SortableHeader heading="Modified"   col="modified" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
          <calcite-table-header heading="" />
        </calcite-table-row>

        {sorted.map(item => {
          const credits = calcCreditsPerMonth(item.type, item.size)
          const isSelected = selectedIds.includes(item.id)
          return (
            <calcite-table-row key={item.id} selected={isSelected || undefined}>
              <calcite-table-cell style={{ textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSelectedId(item.id)}
                  disabled={!isSelected && basketFull}
                  title={!isSelected && basketFull ? `Basket is full (${BASKET_LIMIT} items max)` : undefined}
                  style={{
                    cursor: !isSelected && basketFull ? 'not-allowed' : 'pointer',
                    width: 16, height: 16,
                    opacity: !isSelected && basketFull ? 0.4 : 1,
                  }}
                />
              </calcite-table-cell>
              <calcite-table-cell>{item.title}</calcite-table-cell>
              <calcite-table-cell>
                {(() => {
                  // Use the same colour as the treemap/chip legend for this type.
                  // Falls back to a neutral grey if map not yet available or type unknown.
                  const colour = typeColourMap?.get(item.type) ?? '#595959'
                  return (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '2px 8px 2px 6px',
                      borderRadius: '1rem',
                      background: colour + '22',
                      border: `1px solid ${colour}66`,
                      fontSize: 11,
                      color: 'var(--calcite-color-text-1)',
                      fontFamily: 'var(--calcite-font-family, Avenir Next, sans-serif)',
                      whiteSpace: 'nowrap',
                    }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: colour, flexShrink: 0,
                      }} />
                      {item.type}
                    </span>
                  )
                })()}
              </calcite-table-cell>
              <calcite-table-cell>
                <span style={{
                  color: credits >= 40
                    ? 'var(--calcite-color-status-danger)'
                    : credits >= 5
                    ? 'var(--calcite-color-status-warning)'
                    : 'var(--calcite-color-status-success)',
                  fontWeight: credits >= 5 ? 600 : undefined,
                }}>
                  {credits.toFixed(2)}
                </span>
              </calcite-table-cell>
              <calcite-table-cell>{formatBytes(item.size)}</calcite-table-cell>
              <calcite-table-cell>{item.numViews.toLocaleString()}</calcite-table-cell>
              <calcite-table-cell>{formatDate(item.modified)}</calcite-table-cell>
              <calcite-table-cell>
                <calcite-action
                  icon="launch"
                  text="Open in ArcGIS Online"
                  label="Open in ArcGIS Online"
                  scale="s"
                  onClick={() =>
                    window.open(
                      buildItemUrl(portalHostname, item.id),
                      '_blank',
                      'noopener,noreferrer'
                    )
                  }
                />
              </calcite-table-cell>
            </calcite-table-row>
          )
        })}
      </calcite-table>
    </div>
  )
}
