import { useRef, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { ArcGISIdentityManager } from '@esri/arcgis-rest-request'
import type { ArcGISItem, RelatedItemRef } from '../types/arcgis'
import { useAppStore } from '../store/useAppStore'
import { useTriageSignals, useWebMapDependenciesPhase3 } from '../api/triageSignals'
import { calcCreditsPerMonth } from '../utils/credits'
import { formatStaleness } from '../utils/format'
import { buildItemUrl } from '../utils/portalUrl'
import { iconFor } from '../utils/itemIcons'
import { UsageSignal } from './UsageSignal'
import { DependencyGraphModal } from './DependencyGraphModal'

/** Suggest the most obvious review reason from available signals.
 *  Priority: credits footprint → stale content → no recent views.
 *  Returns empty string if no clear signal stands out. */
function suggestReason(item: ArcGISItem, credits: number): string {
  const daysSinceModified = (Date.now() - item.modified) / (1000 * 60 * 60 * 24)
  if (credits >= 40) return 'Large footprint'
  if (daysSinceModified > 365 && item.numViews < 10) return 'Appears stale'
  if (item.numViews === 0) return 'No recent views'
  if (credits >= 5) return 'Large footprint'
  if (daysSinceModified > 180) return 'Appears stale'
  return ''
}

const ACCESS_ICONS: Record<string, string> = {
  public: 'globe',
  org: 'organization',
  private: 'lock',
}

interface TriageStripProps {
  item: ArcGISItem
  session: ArcGISIdentityManager
  reason?: string
  onReasonChange?: (reason: string) => void
}

function formatCredits(credits: number): string {
  if (credits < 0.01) return '< 0.01 credits/mo'
  if (credits >= 1000) return `${(credits / 1000).toFixed(1)}k credits/mo`
  return `${credits.toFixed(2)} credits/mo`
}

function creditsChipStyle(credits: number): { background: string; color: string } {
  if (credits < 5)  return { background: 'var(--calcite-color-status-success-subtle)', color: 'var(--calcite-color-status-success)' }
  if (credits < 40) return { background: 'var(--calcite-color-status-warning-subtle)', color: 'var(--calcite-color-status-warning)' }
  return              { background: 'var(--calcite-color-status-danger-subtle)',  color: 'var(--calcite-color-status-danger)' }
}

function formatFileSize(bytes: number): string | null {
  if (bytes <= 0) return null
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(0)} KB`
  if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} MB`
  return `${(bytes / 1_073_741_824).toFixed(2)} GB`
}

function SignalLoader() {
  return <calcite-loader scale="s" inline label="Loading" />
}

// ─── Inline expandable dependency section ─────────────────────────────────────

// Truncate item titles in the expanded list to keep rows compact.
function truncateDepLabel(title: string, max = 28): string {
  return title.length > max ? title.slice(0, max - 1) + '…' : title
}

function DepSection({
  label,
  sublabel,
  headerIcon,
  count,
  countSuffix = '',
  items,
  expanded,
  onToggle,
  onViewGraph,
  portalHostname,
}: {
  label: string
  sublabel?: string      // Optional dimmed qualifier shown after the label
  headerIcon: string     // Calcite icon name for the section header
  count: number
  countSuffix?: string   // Optional suffix for count (e.g. '+' for '50+')
  items: RelatedItemRef[]
  expanded: boolean
  onToggle: () => void
  onViewGraph: () => void
  portalHostname?: string | null
}) {
  const hasItems = count > 0

  return (
    <div style={{
      border: '1px solid var(--calcite-color-border-3)',
      borderRadius: 4,
      overflow: 'hidden',
      fontSize: 12,
    }}>
      {/* Header — always visible, clickable when there are items */}
      <div
        role={hasItems ? 'button' : undefined}
        tabIndex={hasItems ? 0 : undefined}
        onClick={hasItems ? onToggle : undefined}
        onKeyDown={hasItems ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle() } } : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 8px',
          cursor: hasItems ? 'pointer' : 'default',
          background: hasItems ? 'var(--calcite-color-foreground-1)' : 'var(--calcite-color-foreground-2)',
          userSelect: 'none',
        }}
      >
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <calcite-icon icon={headerIcon as any} scale="s" style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, fontWeight: 500, color: 'var(--calcite-color-text-2)' }}>
          {label}
          {sublabel && (
            <span style={{ fontWeight: 400, fontSize: 10, color: 'var(--calcite-color-text-3)', marginLeft: 5 }}>
              {sublabel}
            </span>
          )}
        </span>
        <span style={{
          fontSize: 14,  // Increased from 11 to 14
          color: hasItems ? 'var(--calcite-color-text-1)' : 'var(--calcite-color-text-3)',
          fontWeight: hasItems ? 700 : 400,  // Increased from 600 to 700
          marginRight: hasItems ? 2 : 0,
        }}>
          {hasItems ? `${count}${countSuffix}` : 'None'}
        </span>
        {hasItems && (
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
          <calcite-icon icon={(expanded ? 'chevron-up' : 'chevron-down') as any} scale="s" style={{ flexShrink: 0 }} />
        )}
      </div>

      {/* Expanded body */}
      {expanded && hasItems && (
        <div style={{
          borderTop: '1px solid var(--calcite-color-border-3)',
          background: 'var(--calcite-color-foreground-1)',
        }}>
          {items.map(rel => (
            <a
              key={rel.id}
              href={buildItemUrl(portalHostname, rel.id)}
              target="_blank"
              rel="noopener noreferrer"
              title={rel.title}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 8px',
                borderBottom: '1px solid var(--calcite-color-border-3)',
                color: 'var(--calcite-color-text-1)',
                textDecoration: 'none',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'var(--calcite-color-foreground-2)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = '' }}
            >
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <calcite-icon icon={iconFor(rel.type) as any} scale="s" style={{ flexShrink: 0, color: 'var(--calcite-color-text-3)' }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--calcite-color-brand)' }}>
                  {truncateDepLabel(rel.title)}
                </div>
                {rel.type && (
                  <div style={{ fontSize: 10, color: 'var(--calcite-color-text-3)' }}>{rel.type}</div>
                )}
              </div>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <calcite-icon icon={'launch' as any} scale="s" style={{ flexShrink: 0, marginLeft: 'auto', color: 'var(--calcite-color-text-3)' }} />
            </a>
          ))}

          {/* View graph — section-level action */}
          <div style={{ padding: '5px 8px' }}>
            <button
              type="button"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--calcite-color-brand)',
                fontSize: 11,
                fontFamily: 'inherit',
                padding: 0,
              }}
              onClick={e => { e.stopPropagation(); onViewGraph() }}
            >
              View graph →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function SignalError() {
  return (
    <calcite-chip
      kind="neutral"
      icon="exclamation-mark-triangle"
      scale="s"
      label="Unavailable"
    >
      Unavailable
    </calcite-chip>
  )
}

export function TriageStrip({ item, session, reason, onReasonChange }: TriageStripProps) {
  const { toggleSelectedId, isAdmin, portalHostname, orgId } = useAppStore()
  const queryClient = useQueryClient()
  const { owner, dependencies, usageWindows, webMapDeps } = useTriageSignals(item, session)
  const selectRef = useRef<HTMLCalciteSelectElement | null>(null)
  const reasonTooltipRef = useRef<HTMLCalciteTooltipElement>(null)
  const reasonIconRef = useRef<HTMLSpanElement>(null)
  const [expandedDep, setExpandedDep] = useState<'upstream' | 'downstream' | 'webmaps' | 'combined' | null>(null)
  const [thumbError, setThumbError] = useState(false)
  const [showGraph, setShowGraph] = useState(false)
  const [runPhase3, setRunPhase3] = useState(false)  // Tier 2: org-wide scan
  
  // Phase 3 query (triggered when button clicked)
  const phase3 = useWebMapDependenciesPhase3(item, session, runPhase3)
  const hasAutoSuggested = useRef(false)
  
  // Cancel Phase 3 scan immediately
  const cancelPhase3Scan = () => {
    setRunPhase3(false)
    // Immediately cancel the in-flight query
    queryClient.cancelQueries({ 
      queryKey: ['webMapDependencies', item.id, 'org', session.username, orgId] 
    })
  }
  
  // Merge all phases into a single webMapData object
  const webMapData = {
    items: [
      ...(webMapDeps.data ?? []),
      ...(phase3.data ?? []),
    ],
    count: (webMapDeps.data?.length ?? 0) + (phase3.data?.length ?? 0),
    isLoading: webMapDeps.isLoading || phase3.isLoading,
    isSuccess: webMapDeps.isSuccess && (!runPhase3 || phase3.isSuccess),
  }
  
  // Determine current phase for progress display
  const getCurrentPhase = (): { label: string } | null => {
    if (phase3.isLoading) {
      return { label: 'Checking all org dependencies...' }
    }
    if (webMapDeps.phase1Status === 'pending') return { label: 'Checking dependencies...' }
    if (webMapDeps.currentPhase === 1) {
      return { label: 'Checking your Web Maps & Scenes...' }
    }
    if (webMapDeps.currentPhase === 2) {
      return { label: 'Checking public Web Maps & Scenes...' }
    }
    return null
  }
  
  const phaseInfo = getCurrentPhase()
  const isScanning = webMapData.isLoading

  const toggleDep = (kind: 'upstream' | 'downstream' | 'webmaps' | 'combined') =>
    setExpandedDep(prev => prev === kind ? null : kind)

  // Sync select element value when reason prop changes (covers auto-suggestion write-back)
  useEffect(() => {
    const el = selectRef.current
    if (!el || !onReasonChange) return
    const handler = () => {
      const val = el.value ?? ''
      onReasonChange(val)
    }
    el.addEventListener('calciteSelectChange', handler)
    return () => el.removeEventListener('calciteSelectChange', handler)
  }, [onReasonChange])

  // Wire reason-info tooltip imperatively — string referenceElement is unreliable when
  // the anchor is slotted inside a calcite web component (hover listeners never attach).
  useEffect(() => {
    const tooltip = reasonTooltipRef.current
    const anchor = reasonIconRef.current
    if (tooltip && anchor) tooltip.referenceElement = anchor
  }, [])

  // Auto-suggest reason for admins on first signal load — only if no reason is set yet.
  useEffect(() => {
    if (!isAdmin || !onReasonChange || reason || hasAutoSuggested.current) return
    const credits = calcCreditsPerMonth(item.type, item.size)
    const suggested = suggestReason(item, credits)
    if (suggested) {
      hasAutoSuggested.current = true
      onReasonChange(suggested)
    }
  }, [isAdmin, onReasonChange, reason, item, usageWindows.data])

  // Keep the DOM select value in sync when reason changes externally (e.g. auto-suggestion).
  // calcite-select does not reliably react to option[selected] attribute changes after mount.
  useEffect(() => {
    const el = selectRef.current
    if (!el) return
    el.value = reason ?? ''
  }, [reason])

  const credits = calcCreditsPerMonth(item.type, item.size)
  const accessLabel: Record<string, string> = {
    public: 'Public', org: 'Organisation', private: 'Private',
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '10px 16px',
        minHeight: 90,
        borderBottom: '1px solid var(--calcite-color-border-3)',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.background = 'var(--calcite-color-foreground-2)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.background = ''
      }}
    >
      {/* ── Left zone: thumbnail + title, type, access, credits ── */}
      <div style={{ width: '33%', minWidth: 0, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        {item.thumbnail && !thumbError ? (
          <img
            src={`https://www.arcgis.com/sharing/rest/content/items/${encodeURIComponent(item.id)}/info/${item.thumbnail}`}
            alt=""
            width={48}
            height={48}
            style={{ borderRadius: 4, objectFit: 'cover', flexShrink: 0 }}
            onError={() => setThumbError(true)}
          />
        ) : (
          <div style={{
            width: 48, height: 48, flexShrink: 0,
            borderRadius: 4,
            background: 'var(--calcite-color-foreground-2)',
            border: '1px solid var(--calcite-color-border-3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <calcite-icon icon={iconFor(item.type) as any} scale="m" />
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontWeight: 600,
            fontSize: 13,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginBottom: 4,
            color: 'var(--calcite-color-text-1)',
          }}>
            {item.title}
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
            <calcite-chip
              scale="s"
              kind="neutral"
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              icon={iconFor(item.type) as any}
              label={item.type}
            >
              {item.type}
            </calcite-chip>
            <calcite-chip
              scale="s"
              kind="neutral"
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              icon={(ACCESS_ICONS[item.access] ?? 'lock') as any}
              label={accessLabel[item.access] ?? item.access}
            >
              {accessLabel[item.access] ?? item.access}
            </calcite-chip>
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {/* Credits/mo chip — traffic-light colour */}
            {(() => {
              const style = creditsChipStyle(credits)
              return (
                <span style={{
                  background: style.background,
                  color: style.color,
                  borderRadius: 4,
                  padding: '3px 8px',
                  fontSize: 13,
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                }}>
                  {formatCredits(credits)}
                </span>
              )
            })()}
            {/* File size chip — shown when known */}
            {formatFileSize(item.size) && (
              <span style={{
                background: 'var(--calcite-color-foreground-2)',
                color: 'var(--calcite-color-text-2)',
                border: '1px solid var(--calcite-color-border-3)',
                borderRadius: 4,
                padding: '2px 7px',
                fontSize: 11,
                fontWeight: 500,
                whiteSpace: 'nowrap',
              }}>
                {formatFileSize(item.size)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Centre zone: owner, activity, modified ── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {/* Owner */}
        <div style={{ fontSize: 12, color: 'var(--calcite-color-text-2)', display: 'flex', gap: 8, alignItems: 'center' }}>
          <calcite-icon icon="user" scale="s" />
          <span style={{ fontWeight: 500 }}>
            {owner.isLoading && <SignalLoader />}
            {owner.isError && <SignalError />}
            {owner.data && (
              <>
                <span>{owner.data.fullName}</span>
                {owner.data.email && (
                  <>
                    <span style={{ color: 'var(--calcite-color-text-3)', margin: '0 2px' }}>·</span>
                    <span style={{ color: 'var(--calcite-color-text-3)', fontSize: 11, fontWeight: 400 }}>
                      {owner.data.email}
                    </span>
                  </>
                )}
                {owner.data.disabled && (
                  <calcite-chip scale="s" kind="neutral" label="Inactive" style={{ marginLeft: 4 }}>
                    Inactive account
                  </calcite-chip>
                )}
              </>
            )}
          </span>
        </div>

        {/* Usage signal — API-backed 30D/60D windows with traffic-light tier */}
        <UsageSignal
          item={item}
          windows={usageWindows.data}
          isLoading={usageWindows.isLoading}
          isError={usageWindows.isError}
        />

        {/* Modified date */}
        <div style={{ fontSize: 11, color: 'var(--calcite-color-text-3)' }}>
          {formatStaleness(item.modified)}
        </div>
      </div>

      {/* ── Right zone: dependency sections + actions ── */}
      <div style={{
        width: '18%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 8,
        flexShrink: 0,
      }}>
        {/* Reason tag selector — admins only */}
        {onReasonChange !== undefined && (
          <>
            <calcite-label scale="s" style={{ margin: 0 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--calcite-color-text-2)', marginBottom: 3 }}>
                Reason for review
                {/* Tooltip anchor: ref-wired imperatively (string referenceElement is
                    unreliable when the anchor is slotted inside a calcite web component). */}
                <span ref={reasonIconRef} style={{ display: 'inline-flex', lineHeight: 0 }}>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <calcite-icon icon={'information' as any} scale="s" style={{ color: 'var(--calcite-color-text-3)' }} />
                </span>
              </span>
              <calcite-select
                id={`reason-select-${item.id}`}
                ref={selectRef}
                scale="s"
                label="Reason for review"
                style={{ width: '100%' }}
              >
                <calcite-option value="" selected={!reason || undefined}>Select a reason…</calcite-option>
                <calcite-option value="Appears stale"       selected={reason === 'Appears stale' || undefined}>Appears stale</calcite-option>
                <calcite-option value="Large footprint"     selected={reason === 'Large footprint' || undefined}>Large footprint</calcite-option>
                <calcite-option value="No recent views"     selected={reason === 'No recent views' || undefined}>No recent views</calcite-option>
                <calcite-option value="Duplicate content"   selected={reason === 'Duplicate content' || undefined}>Duplicate content</calcite-option>
                <calcite-option value="Other"               selected={reason === 'Other' || undefined}>Other</calcite-option>
              </calcite-select>
            </calcite-label>
            <calcite-tooltip ref={reasonTooltipRef} placement="bottom-end">
              Optional: used for notification
            </calcite-tooltip>
          </>
        )}

        {/* Dependency signals — inline expandable sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
          {dependencies.isLoading && <SignalLoader />}
          {dependencies.isError && <SignalError />}
          {/* Dependency sections — formal relationships + Web Map/Scene scanning */}
          {dependencies.data && (
            <>
              {/* Scanning progress indicator (services only) */}
              {item.type.includes('Service') && isScanning && phaseInfo && (
                <div style={{
                  border: '1px solid var(--calcite-color-border-3)',
                  borderRadius: '6px',
                  padding: '12px',
                  background: 'var(--calcite-color-foreground-1)',
                  marginBottom: 8,
                }}>
                  <div style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--calcite-color-text-2)',
                    marginBottom: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <span>{phaseInfo.label}</span>
                    {/* Cancel button only shown during Phase 3 org-wide scan */}
                    {phase3.isLoading && (
                      <calcite-button
                        appearance="transparent"
                        kind="danger"
                        icon-start="x"
                        scale="s"
                        onClick={cancelPhase3Scan}
                        title="Cancel scan"
                      />
                    )}
                  </div>
                  {/* Simple linear progress bar */}
                  <div style={{
                    height: '4px',
                    background: 'var(--calcite-color-border-2)',
                    borderRadius: '2px',
                    overflow: 'hidden',
                    position: 'relative'
                  }}>
                    <div style={{
                      position: 'absolute',
                      height: '100%',
                      width: '40%',
                      background: 'var(--calcite-color-brand)',
                      borderRadius: '2px',
                      animation: 'indeterminateProgress 2s infinite ease-in-out',
                      animationDelay: `${(item.id.charCodeAt(0) % 10) * 0.1}s`,
                    }} />
                  </div>
                </div>
              )}

              {/* Combined dependency section: Web Maps/Scenes + formal relationships */}
              {(() => {
                const totalCount = dependencies.data.upstream + dependencies.data.downstream + webMapData.count
                const scanComplete = !isScanning && webMapData.isSuccess
                const showSection = totalCount > 0 || scanComplete
                if (!showSection) return null

                const phase3Button = isAdmin && webMapDeps.isSuccess && !runPhase3 && !phase3.isLoading ? (
                  <calcite-button
                    scale="s"
                    kind="neutral"
                    icon-start="organization"
                    style={{ marginTop: 4, width: '100%' }}
                    onClick={() => setRunPhase3(true)}
                  >
                    Search Entire Org (maps & scenes)
                  </calcite-button>
                ) : null

                if (totalCount === 0) {
                  return (
                    <>
                      <div style={{
                        border: '1px solid var(--calcite-color-border-3)',
                        borderRadius: 4,
                        padding: '5px 8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 12,
                        background: 'var(--calcite-color-foreground-2)',
                      }}>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        <calcite-icon icon={'check-circle' as any} scale="s" style={{ flexShrink: 0 }} />
                        <span style={{ fontWeight: 500, color: 'var(--calcite-color-text-2)' }}>
                          No dependencies detected
                        </span>
                      </div>
                      {phase3Button}
                    </>
                  )
                }

                const sublabel = phase3.isSuccess
                  ? "Scanned: your maps, public maps, entire org"
                  : webMapDeps.currentPhase
                    ? `Scanned: your maps${webMapDeps.currentPhase === 2 ? ', public maps' : ''}`
                    : webMapData.items.length > 0
                      ? "Scanned: your maps, public maps"
                      : undefined

                return (
                  <>
                    <DepSection
                      label="Dependencies detected"
                      sublabel={sublabel}
                      headerIcon="conditional-rules"
                      count={totalCount}
                      countSuffix={webMapData.count >= 50 ? '+' : ''}
                      items={[
                        ...dependencies.data.upstreamItems,
                        ...dependencies.data.downstreamItems,
                        ...webMapData.items.map(m => ({ id: m.itemId, title: m.title, type: m.type })),
                      ]}
                      expanded={expandedDep === 'combined'}
                      onToggle={() => toggleDep('combined')}
                      onViewGraph={() => setShowGraph(true)}
                      portalHostname={portalHostname}
                    />
                    {phase3Button}
                  </>
                )
              })()}

              {/* Modal portals to document.body internally */}
              {showGraph && dependencies.data && (
                <DependencyGraphModal
                  item={item}
                  counts={dependencies.data}
                  webMapDeps={webMapData.items}  // Pass merged Phase 1+2+3 results
                  onClose={() => setShowGraph(false)}
                />
              )}
            </>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 4 }}>
          <calcite-action
            id={`triage-launch-${item.id}`}
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
          <calcite-tooltip referenceElement={`triage-launch-${item.id}`} placement="bottom">
            Open in ArcGIS Online
          </calcite-tooltip>
          <calcite-action
            id={`triage-remove-${item.id}`}
            icon="minus-circle"
            text="Remove from review list"
            label="Remove from review list"
            scale="s"
            onClick={() => toggleSelectedId(item.id)}
          />
          <calcite-tooltip referenceElement={`triage-remove-${item.id}`} placement="bottom">
            Remove from review list — does not delete the item from ArcGIS Online
          </calcite-tooltip>
        </div>
      </div>
    </div>
  )
}
