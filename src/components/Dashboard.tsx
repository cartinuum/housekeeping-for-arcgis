import { useMemo } from 'react'
import { useAppStore } from '../store/useAppStore'
import { buildTreemapData, buildTypeColourMap, itemValue } from '../utils/treemap'
import { calcCreditsPerMonth } from '../utils/credits'
import { applyFilters } from '../utils/filters'
import { Toolbar } from './Toolbar'
import { ChipLegend } from './ChipLegend'
import { TreemapView } from './TreemapView'
import { TableView } from './TableView'
import type { ArcGISItem } from '../types/arcgis'
import type { Filters } from '../store/useAppStore'

// Dynamic treemap cap — scale with available screenspace so large monitors show
// more tiles while small screens stay legible. ~6 500 px² per tile is the target.
// Own-scope cap raised to 800 (tested at 2736×1824 where 7 000 divisor was too low).
// Org scope caps at 200 — this is a worst-offenders view, not a full inventory.
function treemapCap(scope: 'own' | 'org'): number {
  const area = window.innerWidth * window.innerHeight
  const byScreen = Math.floor(area / 6_500)
  return scope === 'org'
    ? Math.min(Math.max(byScreen, 75), 200)
    : Math.min(Math.max(byScreen, 75), 800)
}

interface DashboardProps {
  items: ArcGISItem[]
  orgTotal?: number // full org item count — set only in org scope
}

// Same as applyFilters but ignores the types filter — used to compute which
// types have any visible items so the chip legend stays in sync with the
// size/date/credits filters without hiding chips the user has merely deselected.
function applyFiltersExceptTypes(items: ArcGISItem[], filters: Filters): ArcGISItem[] {
  let result = items
  if (filters.minSizeBytes !== null) {
    result = result.filter(i => i.size < 0 || i.size >= filters.minSizeBytes!)
  }
  if (filters.maxSizeBytes !== null) {
    result = result.filter(i => i.size < 0 || i.size <= filters.maxSizeBytes!)
  }
  if (filters.modifiedDaysAgo !== null) {
    const cutoff = Date.now() - filters.modifiedDaysAgo * 86_400_000
    result = result.filter(i => i.modified < cutoff)
  }
  if (filters.minCredits !== null && filters.minCredits > 0) {
    result = result.filter(i => calcCreditsPerMonth(i.type, i.size) >= filters.minCredits!)
  }
  if (filters.maxCredits !== null) {
    result = result.filter(i => calcCreditsPerMonth(i.type, i.size) <= filters.maxCredits!)
  }
  return result
}

export function Dashboard({ items, orgTotal }: DashboardProps) {
  const { activeView, activeMetric, filters, viewScope, selectedIds } = useAppStore()

  const effectiveMetric = activeMetric
  const cap = treemapCap(viewScope)

  const filtered = useMemo(() => applyFilters(items, filters), [items, filters])

  // Items after all filters except types — used to determine which chips to show.
  const filteredExceptTypes = useMemo(
    () => applyFiltersExceptTypes(items, filters),
    [items, filters]
  )

  // Stable colour map from full unfiltered set — colours never shift when filtering
  const typeColourMap = useMemo(
    () => buildTypeColourMap(items, effectiveMetric),
    [items, effectiveMetric]
  )

  // Subset of typeColourMap: only types with at least one item surviving non-type filters
  const visibleTypeColourMap = useMemo(() => {
    const visibleTypes = new Set(filteredExceptTypes.map(i => i.type))
    return new Map(
      Array.from(typeColourMap.entries()).filter(([type]) => visibleTypes.has(type))
    )
  }, [filteredExceptTypes, typeColourMap])

  // Total bytes per type for chip size labels
  const typeSizeMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of filteredExceptTypes) {
      const bytes = Math.max(0, item.size)
      map.set(item.type, (map.get(item.type) ?? 0) + bytes)
    }
    return map
  }, [filteredExceptTypes])

  // Top items for treemap — sorted by effective metric, capped for ECharts performance.
  // Table always receives the full filtered set.
  const treemapItems = useMemo(() => {
    const sorted = [...filtered].sort(
      (a, b) => itemValue(b, effectiveMetric) - itemValue(a, effectiveMetric)
    )
    return sorted.slice(0, cap)
  }, [filtered, effectiveMetric, cap])

  const treemapClipped = filtered.length > cap

  const selectedIdsSet = useMemo(() => new Set(selectedIds), [selectedIds])

  const treemapGroups = useMemo(
    () => buildTreemapData(treemapItems, effectiveMetric, typeColourMap, selectedIdsSet),
    [treemapItems, effectiveMetric, typeColourMap, selectedIdsSet]
  )

  if (items.length === 0) {
    return (
      <calcite-notice kind="info" open style={{ margin: '2rem' }}>
        <span slot="message">This user has no content.</span>
      </calcite-notice>
    )
  }

  const metricLabel = effectiveMetric === 'credits' ? 'credits/mo' : effectiveMetric === 'size' ? 'storage' : 'views'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar />
      <ChipLegend typeColourMap={visibleTypeColourMap} typeSizeMap={typeSizeMap} />

      {/* Org scope context */}
      {viewScope === 'org' && activeView === 'treemap' && (
        <div style={{ padding: '0 8px 4px', fontSize: 12, color: 'var(--calcite-color-text-3)' }}>
          Top {treemapItems.length} items by {metricLabel} across sampled users
          {orgTotal !== undefined && <>. Organisation total: {orgTotal.toLocaleString()} items</>}.
          {treemapClipped && <> Switch to Table for the full {filtered.length.toLocaleString()} item list.</>}
        </div>
      )}

      {/* Own-content clipped notice */}
      {viewScope !== 'org' && activeView === 'treemap' && treemapClipped && (
        <div style={{ padding: '0 8px 4px', fontSize: 12, color: 'var(--calcite-color-text-3)' }}>
          Showing top {cap} of {filtered.length.toLocaleString()} items by {metricLabel}.
          Switch to Table for the full list.
        </div>
      )}

      {/* Credits/mo Feature Service note — Feature Services cost 240 cr/GB vs 1.2 cr/GB
          for all other types (200× ratio), so they dominate the credits view whenever
          present. Prompt the user to switch to Storage to compare all content types
          proportionally. Only shown in credits view when Feature Services are visible. */}
      {activeView === 'treemap' && effectiveMetric === 'credits' && treemapGroups.some(g => g.name === 'Feature Service') && (
        <div style={{ padding: '0 8px 2px', fontSize: 11, color: 'var(--calcite-color-text-3)' }}>
          Feature Services dominate credits due to their higher storage rate. Switch to Storage to compare all content types.
        </div>
      )}

      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0, padding: '0 8px 8px' }}>
        {activeView === 'treemap' ? (
          <TreemapView groups={treemapGroups} />
        ) : (
          <TableView items={filtered} typeColourMap={typeColourMap} />
        )}
      </div>
    </div>
  )
}
