import { useState, useRef } from 'react'
import { useAppStore } from '../store/useAppStore'
import { OTHER_COLOUR } from '../utils/treemap'
import { iconFor } from '../utils/itemIcons'

interface ChipLegendProps {
  typeColourMap: Map<string, string>
  /** Total bytes per type (from pre-type-filter data) — drives the size label in each chip */
  typeSizeMap: Map<string, number>
}

// Credit storage rates shown in the hover tip
const TYPE_CREDIT_TIPS: Record<string, string> = {
  'Feature Service': '240 cr / GB / mo',
  'Notebook': '12 cr / GB / mo',
}
const DEFAULT_CREDIT_TIP = '1.2 cr / GB / mo'

function creditTipFor(typeName: string): string {
  return TYPE_CREDIT_TIPS[typeName] ?? DEFAULT_CREDIT_TIP
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r}, ${g}, ${b}`
}

function formatSize(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`
  if (bytes >= 1_048_576) return `${Math.round(bytes / 1_048_576)} MB`
  return `${Math.round(bytes / 1024)} KB`
}

export function ChipLegend({ typeColourMap, typeSizeMap }: ChipLegendProps) {
  const { filters, setFilters, activeMetric } = useAppStore()
  const [visibleTip, setVisibleTip] = useState<string | null>(null)
  const tipTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  if (typeColourMap.size === 0) return null

  // Separate named types (top-5 colours) from the grey "Other" bucket
  const namedEntries = Array.from(typeColourMap.entries()).filter(([, c]) => c !== OTHER_COLOUR)
  const otherTypeNames = Array.from(typeColourMap.entries())
    .filter(([, c]) => c === OTHER_COLOUR)
    .map(([t]) => t)

  // No type filter = all chips are "on". A specific type is selected = only it is "on".
  const noneSelected = filters.types.length === 0

  // Click → single-select that type (click again to clear).
  // Ctrl/Cmd + click → toggle this type into/out of a multi-selection.
  function selectType(typeName: string, multi: boolean) {
    if (multi) {
      const current = filters.types
      if (current.length === 0) {
        setFilters({ types: [typeName] })
      } else {
        const next = current.includes(typeName)
          ? current.filter(t => t !== typeName)
          : [...current, typeName]
        setFilters({ types: next })
      }
    } else {
      const isOnlySelected = filters.types.length === 1 && filters.types[0] === typeName
      setFilters({ types: isOnlySelected ? [] : [typeName] })
    }
  }

  // "Other" chip represents all grey-colour types as a group.
  const otherHasFilter = otherTypeNames.some(t => filters.types.includes(t))

  function selectOther(multi: boolean) {
    if (otherTypeNames.length === 0) return
    if (multi) {
      if (!otherHasFilter) {
        const current = filters.types
        if (current.length === 0) {
          setFilters({ types: otherTypeNames })
        } else {
          setFilters({ types: [...new Set([...current, ...otherTypeNames])] })
        }
      } else {
        setFilters({ types: filters.types.filter(t => !otherTypeNames.includes(t)) })
      }
    } else {
      const onlyOtherSelected = filters.types.length > 0 && filters.types.every(t => otherTypeNames.includes(t))
      setFilters({ types: onlyOtherSelected ? [] : otherTypeNames })
    }
  }

  function onChipMouseEnter(typeName: string) {
    clearTimeout(tipTimerRef.current)
    tipTimerRef.current = setTimeout(() => setVisibleTip(typeName), 800)
  }

  function onChipMouseLeave() {
    clearTimeout(tipTimerRef.current)
    setVisibleTip(null)
  }

  function renderChip(typeName: string, colour: string) {
    const selected = !noneSelected && filters.types.includes(typeName)
    const dimmed = !noneSelected && !selected
    const rgb = hexToRgb(colour)
    const sizeBytes = typeSizeMap.get(typeName) ?? 0

    return (
      <div key={typeName} style={{ position: 'relative' }}>
        <button
          onClick={(e: React.MouseEvent) => selectType(typeName, e.ctrlKey || e.metaKey)}
          onMouseEnter={() => onChipMouseEnter(typeName)}
          onMouseLeave={onChipMouseLeave}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '3px 10px',
            borderRadius: '1rem',
            border: `2px solid ${colour}`,
            background: (noneSelected || selected) ? colour : 'transparent',
            color: (noneSelected || selected) ? '#fff' : colour,
            cursor: 'pointer',
            fontFamily: 'var(--calcite-font-family, Avenir Next, sans-serif)',
            fontSize: '12px',
            fontWeight: 500,
            transition: 'all 0.15s ease',
            opacity: dimmed ? 0.4 : 1,
            boxShadow: selected ? `0 0 0 3px rgba(${rgb}, 0.3)` : 'none',
          }}
        >
          <calcite-icon
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            icon={iconFor(typeName) as any}
            scale="s"
            style={{ color: (noneSelected || selected) ? '#fff' : colour } as React.CSSProperties}
          />
          {sizeBytes > 0 && (
            <span style={{ fontWeight: 700 }}>{formatSize(sizeBytes)}</span>
          )}
          {typeName}
        </button>

        {visibleTip === typeName && activeMetric === 'credits' && (
          <div
            style={{
              position: 'absolute',
              bottom: 'calc(100% + 6px)',
              left: '50%',
              transform: 'translateX(-50%)',
              whiteSpace: 'nowrap',
              background: 'var(--calcite-color-foreground-1)',
              border: '1px solid var(--calcite-color-border-2)',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '11px',
              color: 'var(--calcite-color-text-2)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
              pointerEvents: 'none',
              animation: 'fadeInTip 0.2s ease',
              zIndex: 100,
            }}
          >
            {creditTipFor(typeName)}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', padding: '0.25rem 1rem 0.125rem' }}>
      {namedEntries.map(([typeName, colour]) => renderChip(typeName, colour))}

      {/* All grey "Other" types bundled into a single chip */}
      {otherTypeNames.length > 0 && (() => {
        const otherSelected = !noneSelected && otherHasFilter
        const otherDimmed = !noneSelected && !otherHasFilter
        const rgb = hexToRgb(OTHER_COLOUR)
        const otherSizeBytes = otherTypeNames.reduce((sum, t) => sum + (typeSizeMap.get(t) ?? 0), 0)

        return (
          <button
            onClick={(e: React.MouseEvent) => selectOther(e.ctrlKey || e.metaKey)}
            title={otherTypeNames.join(', ')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '3px 10px',
              borderRadius: '1rem',
              border: `2px solid ${OTHER_COLOUR}`,
              background: (noneSelected || otherSelected) ? OTHER_COLOUR : 'transparent',
              color: (noneSelected || otherSelected) ? '#fff' : OTHER_COLOUR,
              cursor: 'pointer',
              fontFamily: 'var(--calcite-font-family, Avenir Next, sans-serif)',
              fontSize: '12px',
              fontWeight: 500,
              transition: 'all 0.15s ease',
              opacity: otherDimmed ? 0.4 : 1,
              boxShadow: otherSelected ? `0 0 0 3px rgba(${rgb}, 0.3)` : 'none',
            }}
          >
            <calcite-icon
              icon="apps"
              scale="s"
              style={{ color: (noneSelected || otherSelected) ? '#fff' : OTHER_COLOUR } as React.CSSProperties}
            />
            {otherSizeBytes > 0 && (
              <span style={{ fontWeight: 700 }}>{formatSize(otherSizeBytes)}</span>
            )}
            Other
          </button>
        )
      })()}
    </div>
  )
}
