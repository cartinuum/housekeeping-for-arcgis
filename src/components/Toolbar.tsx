import { useRef, useEffect } from 'react'
import { useAppStore, type ActiveView, type ActiveMetric } from '../store/useAppStore'

export function Toolbar() {
  const { activeView, setActiveView, activeMetric, setActiveMetric, sidebarOpen, setSidebarOpen } = useAppStore()

  const viewControlRef = useRef<HTMLCalciteSegmentedControlElement>(null)
  const metricControlRef = useRef<HTMLCalciteSegmentedControlElement>(null)

  useEffect(() => {
    const el = viewControlRef.current
    if (!el) return
    const handler = (e: Event) => {
      const target = e.target as HTMLCalciteSegmentedControlElement
      setActiveView(target.value as ActiveView)
    }
    el.addEventListener('calciteSegmentedControlChange', handler)
    return () => el.removeEventListener('calciteSegmentedControlChange', handler)
  }, [setActiveView])

  useEffect(() => {
    const el = metricControlRef.current
    if (!el) return
    const handler = (e: Event) => {
      const target = e.target as HTMLCalciteSegmentedControlElement
      setActiveMetric(target.value as ActiveMetric)
    }
    el.addEventListener('calciteSegmentedControlChange', handler)
    return () => el.removeEventListener('calciteSegmentedControlChange', handler)
  // activeView in deps ensures listener is reattached when switching back to treemap
  }, [setActiveMetric, activeView])

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.375rem 1rem',
        borderBottom: '1px solid var(--calcite-color-border-3)',
      }}
    >
      <calcite-action
        icon="dock-left"
        text={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
        label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
        scale="s"
        appearance="transparent"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        active={sidebarOpen ? (true as any) : undefined}
        onClick={() => setSidebarOpen(!sidebarOpen)}
      />

      <calcite-segmented-control ref={viewControlRef} scale="s">
        <calcite-segmented-control-item value="treemap" icon-start="grid-unit" checked={activeView === 'treemap' || undefined}>
          Treemap
        </calcite-segmented-control-item>
        <calcite-segmented-control-item value="table" icon-start="table" checked={activeView === 'table' || undefined}>
          Table
        </calcite-segmented-control-item>
      </calcite-segmented-control>

      {activeView === 'treemap' && (
        <calcite-segmented-control ref={metricControlRef} scale="s">
          <calcite-segmented-control-item value="credits" checked={activeMetric === 'credits' || undefined}>
            Credits/mo
          </calcite-segmented-control-item>
          <calcite-segmented-control-item value="size" checked={activeMetric === 'size' || undefined}>
            Storage
          </calcite-segmented-control-item>
        </calcite-segmented-control>
      )}
    </div>
  )
}
