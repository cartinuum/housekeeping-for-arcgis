import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import type { ECElementEvent, CallbackDataParams } from 'echarts/types/dist/shared'
import type { ArcGISItem } from '../types/arcgis'
import type { TreemapGroupNode } from '../utils/treemap'
import { itemCreditsPerMonth } from '../utils/credits'
import { formatBytes, formatStaleness } from '../utils/format'
import { buildItemUrl } from '../utils/portalUrl'
import { iconFor, resolveDisplayType } from '../utils/itemIcons'
import { useAppStore } from '../store/useAppStore'
import { BASKET_LIMIT } from './BasketPanel'

interface TreemapViewProps {
  groups: TreemapGroupNode[]
}

// Minimal shape of data attached to each ECharts treemap node by buildTreemapData()
interface TreemapNodeData {
  item?: ArcGISItem
  itemStyle?: { color: string }
  [key: string]: unknown
}

// ECharts treemap event params — extends ECElementEvent with treemap-specific fields
type TreemapEventParams = Omit<ECElementEvent, 'data'> & {
  data: TreemapNodeData
  treePathInfo?: Array<{ name: string }>
}

interface TooltipState {
  item: ArcGISItem
  colour: string
  x: number
  y: number
}

interface TooltipOverlayProps {
  item: ArcGISItem
  colour: string
  x: number
  y: number
  onMouseEnter: () => void
  onMouseLeave: () => void
}

function TooltipOverlay({ item, colour, x, y, onMouseEnter, onMouseLeave }: TooltipOverlayProps) {
  const credits = itemCreditsPerMonth(item)
  const { selectedIds, toggleSelectedId, portalHostname } = useAppStore()
  const displayType = resolveDisplayType(item.type, item.typeKeywords)
  const itemUrl = buildItemUrl(portalHostname, item.id)
  const isSelected = selectedIds.includes(item.id)
  const basketFull = selectedIds.length >= BASKET_LIMIT
  const canAdd = isSelected || !basketFull

  const thumbUrl = item.thumbnail
    ? `https://www.arcgis.com/sharing/rest/content/items/${encodeURIComponent(item.id)}/info/${item.thumbnail}`
    : null

  // Position: offset right and slightly up from cursor; clamp to viewport edges
  const TOOLTIP_W = 340
  const TOOLTIP_H = 220 // approximate — avoid too-aggressive clamping
  const left = Math.min(x + 16, window.innerWidth - TOOLTIP_W - 8)
  const top = Math.min(y - 20, window.innerHeight - TOOLTIP_H - 8)

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'fixed',
        left,
        top,
        zIndex: 9999,
        background: '#2a2a2a',
        border: '1px solid #444',
        borderRadius: 6,
        padding: '12px',
        maxWidth: TOOLTIP_W,
        width: TOOLTIP_W,
        fontFamily: 'var(--calcite-font-family, Avenir Next, sans-serif)',
        color: '#fff',
        boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
        pointerEvents: 'auto',
      }}
    >
      {/* Header: thumbnail + title/type */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
        {thumbUrl ? (
          <img
            src={thumbUrl}
            width={72}
            height={72}
            alt=""
            style={{ objectFit: 'cover', borderRadius: 6, flexShrink: 0 }}
            onError={e => {
              const img = e.currentTarget
              const fallback = img.nextElementSibling as HTMLElement | null
              if (fallback) {
                img.style.display = 'none'
                fallback.style.display = 'flex'
              }
            }}
          />
        ) : null}
        <div
          style={{
            width: 72, height: 72,
            background: colour,
            borderRadius: 6,
            display: thumbUrl ? 'none' : 'flex',
            alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 11, textAlign: 'center',
            padding: 4, flexShrink: 0,
          }}
        >
          {displayType}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.3, marginBottom: 6 }}>
            {item.title}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{
              background: colour, borderRadius: 12,
              padding: '2px 8px', fontSize: 11, color: '#fff', whiteSpace: 'nowrap',
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <calcite-icon icon={iconFor(displayType) as any} scale="s" style={{ color: '#fff' } as React.CSSProperties} />
              {displayType}
            </span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              fontSize: 11, color: '#aaa', textTransform: 'capitalize',
            }}>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <calcite-icon icon={({ public: 'globe', org: 'organization', private: 'lock' }[item.access] ?? 'lock') as any} scale="s" style={{ color: '#aaa' } as React.CSSProperties} />
              {item.access === 'org' ? 'Organisation' : item.access}
            </span>
          </div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>Owner: {item.owner}</div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{formatStaleness(item.modified)}</div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8,
        borderTop: '1px solid #444', borderBottom: '1px solid #444',
        padding: '8px 0', textAlign: 'center', marginBottom: 10,
      }}>
        <div>
          <div style={{ fontSize: '1.1em', fontWeight: 700, color: '#de2900' }}>{credits.toFixed(1)}</div>
          <div style={{ fontSize: 10, color: '#aaa' }}>credits/mo</div>
        </div>
        <div>
          <div style={{ fontSize: '1.1em', fontWeight: 700, color: '#0079c1' }}>{formatBytes(item.size)}</div>
          <div style={{ fontSize: 10, color: '#aaa' }}>storage</div>
        </div>
        <div>
          <div style={{ fontSize: '1.1em', fontWeight: 700, color: '#338033' }}>{item.numViews.toLocaleString()}</div>
          <div style={{ fontSize: 10, color: '#aaa' }}>views</div>
        </div>
      </div>

      {/* Footer: action buttons */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => (isSelected || canAdd) && toggleSelectedId(item.id)}
            title={!isSelected && !canAdd ? `Basket full (${BASKET_LIMIT} items max)` : undefined}
            style={{
              background: isSelected ? '#338033' : canAdd ? '#595959' : '#3a3a3a',
              border: 'none', borderRadius: 4,
              color: isSelected || canAdd ? '#fff' : '#888',
              cursor: isSelected || canAdd ? 'pointer' : 'not-allowed',
              padding: '5px 10px',
              fontSize: 12, fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}
          >
            {isSelected ? '✓ In basket' : '+ Review'}
          </button>
          <button
            onClick={() => window.open(itemUrl, '_blank', 'noopener,noreferrer')}
            style={{
              background: '#0079c1', border: 'none', borderRadius: 4,
              color: '#fff', cursor: 'pointer', padding: '5px 10px',
              fontSize: 12, fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}
          >
            ↗ Open
          </button>
        </div>
      </div>
    </div>
  )
}

export function TreemapView({ groups }: TreemapViewProps) {
  const { activeMetric, selectedIds, toggleSelectedId, portalHostname } = useAppStore()
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const [isDrilled, setIsDrilled] = useState(false)
  // Delay closing so mouse can move from tile into overlay without it vanishing
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Delay opening so fast mouse movements don't flash the tooltip
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const echartsRef = useRef<ReactECharts>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // ECharts measures its own DOM element when resize() is called, but that
  // element carries a stale fixed-pixel size set during initialisation.
  // Fix: read dimensions directly from containerRef (the wrapper div that
  // ResizeObserver tracks) and pass them explicitly — no DOM style hacks needed.
  const resizeChart = useCallback(() => {
    const instance = echartsRef.current?.getEchartsInstance()
    if (!instance) return
    const container = containerRef.current
    if (container) {
      const { width, height } = container.getBoundingClientRect()
      if (width > 0 && height > 0) {
        instance.resize({ width, height })
        return
      }
    }
    instance.resize()
  }, [])

  // Observe our own wrapper div (not ECharts' internal DOM) so that when
  // calcite-shell's CSS grid settles after web component upgrade, the size
  // change is visible here and we can tell ECharts to re-measure.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(resizeChart)
    ro.observe(el)
    return () => ro.disconnect()
  }, [resizeChart])

  // Reset drill state whenever data changes (filter applied, scope switched).
  // ECharts resets treemap zoom on data change, so our state must match.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDrilled(false)
  }, [groups])

  const scheduleClose = useCallback(() => {
    closeTimer.current = setTimeout(() => setTooltip(null), 150)
  }, [])

  const cancelClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
  }, [])

  const cancelOpen = useCallback(() => {
    if (openTimer.current) clearTimeout(openTimer.current)
  }, [])

  const handleMouseover = useCallback((params: TreemapEventParams) => {
    cancelClose()
    cancelOpen()
    const item: ArcGISItem | undefined = params.data?.item
    if (!item) return

    const colour: string = params.data?.itemStyle?.color ?? '#595959'
    const nativeEvent = params.event?.event as MouseEvent | undefined
    if (!nativeEvent) return

    // ~250ms delay before showing tooltip — prevents flashing on fast cursor movements
    const x = nativeEvent.clientX
    const y = nativeEvent.clientY
    openTimer.current = setTimeout(() => {
      // Highlight all tiles of the same type by emphasising the parent group node.
      // With focus:'descendant' on the group level, this dims all other groups and
      // makes every sibling tile of the same type glow — the WinDirStat flash effect.
      const instance = echartsRef.current?.getEchartsInstance()
      if (instance) {
        instance.dispatchAction({ type: 'highlight', seriesIndex: 0, name: item.type })
      }
      setTooltip({ item, colour, x, y })
    }, 250)
  }, [cancelClose, cancelOpen])

  const handleMouseout = useCallback(() => {
    cancelOpen()
    scheduleClose()
    const instance = echartsRef.current?.getEchartsInstance()
    instance?.dispatchAction({ type: 'downplay', seriesIndex: 0 })
  }, [cancelOpen, scheduleClose])

  function handleClick(params: TreemapEventParams) {
    const item: ArcGISItem | undefined = params.data?.item
    if (item) {
      const nativeEvent = params.event?.event as MouseEvent | undefined
      if (nativeEvent?.ctrlKey || nativeEvent?.metaKey) {
        // Ctrl/Cmd+click — open item in ArcGIS Online directly, bypassing the tooltip
        const itemUrl = buildItemUrl(portalHostname, item.id)
        window.open(itemUrl, '_blank', 'noopener,noreferrer')
      } else {
        // Plain click — toggle basket membership.
        // Basket-full guard: only add if there's room (removing is always allowed).
        const isSelected = selectedIds.includes(item.id)
        if (isSelected || selectedIds.length < BASKET_LIMIT) {
          toggleSelectedId(item.id)
        }
      }
    } else {
      // Group node — user is drilling into a type group
      setIsDrilled(true)
    }
  }

  // Fired by ECharts when the treemap zooms to a node (both drill-in and breadcrumb back).
  // treePathInfo is the array of ancestor nodes at the zoom target; length <= 1 means root.
  const handleZoomToNode = useCallback((params: TreemapEventParams) => {
    const depth: number = params.treePathInfo?.length ?? 0
    if (depth <= 1) setIsDrilled(false)
  }, [])

  const option = useMemo(() => ({
    backgroundColor: 'transparent',
    series: [
      {
        type: 'treemap',
        data: groups,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        roam: false,
        leafDepth: 2,
        nodeClick: 'zoomToNode',
        breadcrumb: {
          show: isDrilled,
          bottom: 4,
          height: 22,
          itemStyle: {
            color: '#0079c1',
            borderColor: '#005e95',
            borderWidth: 1,
            shadowBlur: 0,
            textStyle: { color: '#ffffff', fontSize: 11 },
          },
          emphasis: {
            itemStyle: { color: '#005e95' },
          },
        },
        // Group level: focus:'descendant' means highlighting a group dims all
        // other groups and makes every child tile of that group glow.
        levels: [
          {
            emphasis: { focus: 'descendant' },
            itemStyle: { borderWidth: 1.5, borderColor: '#ffffff', gapWidth: 1 },
            // upperLabel: the header bar shown on group tiles when leafDepth is set and
            // children are visible. Without this, type-name labels are never rendered —
            // `label` only applies to fully-collapsed (leaf-depth) nodes.
            upperLabel: {
              show: true,
              height: 22,
              color: '#ffffff',
              fontSize: 11,
              fontWeight: 'bold' as const,
              overflow: 'truncate',
              textBorderColor: 'rgba(0,0,0,0.55)',
              textBorderWidth: 1.5,
            },
          },
          {
            itemStyle: { borderWidth: 0.5, borderColor: '#ffffff', gapWidth: 0.5 },
          },
        ],
        label: {
          show: true,
          formatter: (params: CallbackDataParams) => {
            const data = params.data as TreemapNodeData & { credits?: number }
            if (!data?.item) return '' // group tiles handled by upperLabel
            const val = params.value as number
            if (val < 0.01) return '' // below MIN_VALUE floor — truly empty items
            
            if (activeMetric === 'size') {
              return formatBytes(val === 0.01 ? data.item.size : val)
            }
            const credits = data.credits ?? val
            return `${credits.toFixed(1)} cr/mo`
          },
          overflow: 'truncate',
          color: '#ffffff',
          fontSize: 11,
          textBorderColor: 'rgba(0,0,0,0.55)',
          textBorderWidth: 1.5,
        },
        itemStyle: {
          borderWidth: 0.5,
          borderColor: '#ffffff',
          gapWidth: 0.5,
        },
      },
    ],
    tooltip: { show: false },
  }), [groups, isDrilled, activeMetric]) // Re-create option when these change

  return (
    <>
      <div ref={containerRef} style={{ height: '100%', width: '100%' }}>
        <ReactECharts
          ref={echartsRef}
          option={option}
          style={{ height: '100%', width: '100%' }}
          opts={{ renderer: 'canvas' }}
          onChartReady={() => {
            // Cascading resize: Calcite CSS grid, chip legend and toolbar all
            // settle asynchronously. Each call clears ECharts' stale inline
            // style before resizing so it reads the parent's actual width.
            ;[100, 400, 800, 1500].forEach(ms => setTimeout(resizeChart, ms))
          }}
          onEvents={{
            click: handleClick,
            mouseover: handleMouseover,
            mouseout: handleMouseout,
            treemapZoomToNode: handleZoomToNode,
          }}
        />
      </div>
      {tooltip && (
        <TooltipOverlay
          item={tooltip.item}
          colour={tooltip.colour}
          x={tooltip.x}
          y={tooltip.y}
          onMouseEnter={cancelClose}
          onMouseLeave={() => setTooltip(null)}
        />
      )}
    </>
  )
}
