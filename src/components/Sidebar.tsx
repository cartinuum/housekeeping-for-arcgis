import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useAppStore } from '../store/useAppStore'
import type { ArcGISItem, UserInfo } from '../types/arcgis'
import type { ViewScope } from '../store/useAppStore'
import { calcCreditsPerMonth } from '../utils/credits'
import { formatBytes } from '../utils/format'
import { useOrgUsers } from '../api/orgUsers'
import { useAuth } from '../auth/useAuth'
import { PORTAL_URL } from '../config'

// Friendly display names for ArcGIS Online role identifiers
const ROLE_ALIASES: Record<string, string> = {
  org_admin: 'Administrator',
  org_publisher: 'Publisher',
  org_user: 'User',
  org_viewer: 'Viewer',
}
function friendlyRole(role: string): string {
  return ROLE_ALIASES[role] ?? role
}

// Non-linear size steps — slider value is the index (0–8), not bytes directly.
const SIZE_STEPS_MB = [1, 5, 10, 25, 50, 100, 250, 500, 1024]
const SIZE_MAX_IDX = SIZE_STEPS_MB.length - 1

function mbToBytes(mb: number): number {
  return mb * 1_048_576
}

function bytesToMinIdx(bytes: number | null): number {
  if (bytes === null) return 0
  const mb = Math.round(bytes / 1_048_576)
  const idx = SIZE_STEPS_MB.indexOf(mb)
  return idx >= 0 ? idx : 0
}

function bytesToMaxIdx(bytes: number | null): number {
  if (bytes === null) return SIZE_MAX_IDX
  const mb = Math.round(bytes / 1_048_576)
  const idx = SIZE_STEPS_MB.indexOf(mb)
  return idx >= 0 ? idx : SIZE_MAX_IDX
}

function formatSizeMb(mb: number): string {
  if (mb >= 1024) return `${mb / 1024} GB`
  return `${mb} MB`
}

const MODIFIED_OPTIONS = [
  { label: 'Any age',   value: '' },
  { label: '90+ days',  value: '90' },
  { label: '6 months+', value: '180' },
  { label: '1 year+',   value: '365' },
  { label: '2 years+',  value: '730' },
  { label: '3 years+',  value: '1095' },
]

interface SidebarProps {
  userInfo: UserInfo
  items: ArcGISItem[]
  isAdmin: boolean
  canEmulate: boolean      // has portal:admin:viewUsers privilege
  onEmulateUser?: (username: string) => void
  orgTotal?: number        // true org item count from lightweight /search (org scope only)
  orgTruncated?: boolean   // true when combined items exceeded the 500-item cap
  orgUsersScanned?: number // number of users sampled (org scope only)
}

export function Sidebar({ userInfo, items, isAdmin, canEmulate, onEmulateUser, orgTotal, orgTruncated, orgUsersScanned }: SidebarProps) {
  const { filters, setFilters, activeMetric, viewingUser, viewScope, setViewScope } = useAppStore()
  const { session } = useAuth()

  const sizeSliderRef = useRef<HTMLCalciteSliderElement>(null)
  const modifiedSelectRef = useRef<HTMLCalciteSelectElement>(null)
  const creditsSliderRef = useRef<HTMLCalciteSliderElement>(null)
  const scopeControlRef = useRef<HTMLCalciteSegmentedControlElement>(null)

  // Derived values needed by slider effects — must be declared before the effects.
  const maxCredits = Math.ceil(
    items.reduce((max, i) => Math.max(max, calcCreditsPerMonth(i.type, i.size)), 0)
  )

  // Wire up size range slider (both handles)
  useEffect(() => {
    const el = sizeSliderRef.current as (HTMLCalciteSliderElement & { minValue: number; maxValue: number }) | null
    if (!el) return
    const handler = () => {
      const minIdx = Number(el.minValue)
      const maxIdx = Number(el.maxValue)
      setFilters({
        minSizeBytes: minIdx <= 0 ? null : mbToBytes(SIZE_STEPS_MB[minIdx] ?? 1),
        maxSizeBytes: maxIdx >= SIZE_MAX_IDX ? null : mbToBytes(SIZE_STEPS_MB[maxIdx] ?? SIZE_STEPS_MB[SIZE_MAX_IDX]),
      })
    }
    el.addEventListener('calciteSliderInput', handler)
    return () => el.removeEventListener('calciteSliderInput', handler)
  }, [setFilters])

  // Sync size slider handles when filters reset externally
  useEffect(() => {
    const el = sizeSliderRef.current as (HTMLCalciteSliderElement & { minValue: number; maxValue: number }) | null
    if (!el) return
    el.minValue = bytesToMinIdx(filters.minSizeBytes)
    el.maxValue = bytesToMaxIdx(filters.maxSizeBytes)
  }, [filters.minSizeBytes, filters.maxSizeBytes])

  // Wire up last modified filter
  useEffect(() => {
    const el = modifiedSelectRef.current
    if (!el) return
    const handler = () => {
      const val = el.value
      setFilters({ modifiedDaysAgo: val === '' ? null : Number(val) })
    }
    el.addEventListener('calciteSelectChange', handler)
    return () => el.removeEventListener('calciteSelectChange', handler)
  }, [setFilters])

  // Wire up credits range slider (both handles)
  useEffect(() => {
    const el = creditsSliderRef.current as (HTMLCalciteSliderElement & { minValue: number; maxValue: number }) | null
    if (!el) return
    const handler = () => {
      const sliderMax = el.max !== undefined ? Number(el.max) : 100
      const minVal = Number(el.minValue)
      const maxVal = Number(el.maxValue)
      setFilters({
        minCredits: minVal <= 0 ? null : minVal,
        maxCredits: maxVal >= sliderMax ? null : maxVal,
      })
    }
    el.addEventListener('calciteSliderInput', handler)
    return () => el.removeEventListener('calciteSliderInput', handler)
  }, [setFilters, activeMetric])

  // Sync credits slider handles when filters reset externally
  useEffect(() => {
    const el = creditsSliderRef.current as (HTMLCalciteSliderElement & { minValue: number; maxValue: number }) | null
    if (!el) return
    el.minValue = filters.minCredits ?? 0
    el.maxValue = filters.maxCredits ?? (maxCredits || 100)
  }, [filters.minCredits, filters.maxCredits, maxCredits])


  // Wire scope segmented control
  useEffect(() => {
    const el = scopeControlRef.current
    if (!el) return
    const handler = () => {
      const val = (el as HTMLCalciteSegmentedControlElement & { value: string }).value as ViewScope
      if (val === 'own' || val === 'org') setViewScope(val)
    }
    el.addEventListener('calciteSegmentedControlChange', handler)
    return () => el.removeEventListener('calciteSegmentedControlChange', handler)
  }, [setViewScope])

  const totalCredits = items.reduce(
    (sum, item) => sum + calcCreditsPerMonth(item.type, item.size),
    0
  )
  const totalStorageBytes = items.reduce(
    (sum, item) => sum + Math.max(0, item.size),
    0
  )

  const [avatarError, setAvatarError] = useState(false)
  const token = session?.token
  const avatarUrl = !avatarError && userInfo.thumbnail
    ? `${PORTAL_URL}/community/users/${encodeURIComponent(userInfo.username)}/info/${userInfo.thumbnail}${token ? `?token=${encodeURIComponent(token)}` : ''}`
    : undefined

  return (
    <calcite-shell-panel slot="panel-start" displayMode="float">

      {/* ── Profile card ──────────────────────────────────────── */}
      <div style={{ padding: '0.75rem 0.75rem 0' }}>
        <calcite-card>
          {/* Centred avatar + identity */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', paddingBottom: '0.75rem' }}>
            {/* Emulation mode: dashed warning ring indicates this is an emulated user, not the signed-in admin */}
            <div style={{
              borderRadius: '50%',
              padding: viewingUser ? '3px' : 0,
              border: viewingUser ? '2px dashed var(--calcite-color-status-warning)' : 'none',
              display: 'inline-block',
            }}>
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={userInfo.fullName}
                  width={64}
                  height={64}
                  style={{ borderRadius: '50%', objectFit: 'cover', display: 'block' }}
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <calcite-avatar scale="l" fullName={userInfo.fullName} />
              )}
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{userInfo.fullName}</div>
              <div style={{ fontSize: 12, color: 'var(--calcite-color-text-3)', marginBottom: 6 }}>
                {userInfo.username}
              </div>
              <calcite-chip kind="neutral" scale="s" label={friendlyRole(userInfo.role)}>
                Role: {friendlyRole(userInfo.role)}
              </calcite-chip>
            </div>

            {/* Credit estimate — hidden in org scope (size:-1 from search API makes credits meaningless) */}
            {viewScope !== 'org' && (
              <div style={{ fontSize: 13, textAlign: 'center' }}>
                Estimated{' '}
                <strong style={{ color: '#de2900', fontSize: 16 }}>{totalCredits.toFixed(1)}</strong>
                {' '}credits / month
              </div>
            )}

            {/* Stats row */}
            <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
              <div style={{
                flex: 1,
                background: 'var(--calcite-color-foreground-2)',
                borderRadius: '4px',
                padding: '5px 4px',
                textAlign: 'center',
              }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>
                  {viewScope === 'org'
                    ? (orgTotal ?? items.length).toLocaleString() + (orgTruncated ? '+' : '')
                    : items.length.toLocaleString()}
                </div>
                <div style={{ fontSize: 10, color: 'var(--calcite-color-text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Items</div>
              </div>
              <div style={{
                flex: 1,
                background: 'var(--calcite-color-foreground-2)',
                borderRadius: '4px',
                padding: '5px 4px',
                textAlign: 'center',
              }}>
                {/* Storage totals from /search are unreliable (size:-1 for hosted services) */}
                {viewScope === 'org' ? (
                  <>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>N/A</div>
                    <div style={{ fontSize: 10, color: 'var(--calcite-color-text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Storage</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{formatBytes(totalStorageBytes)}</div>
                    <div style={{ fontSize: 10, color: 'var(--calcite-color-text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Storage</div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Org scope: sampling strategy context */}
          {viewScope === 'org' && (
            <calcite-notice kind="info" open scale="s" style={{ marginTop: '0.5rem' }}>
              <span slot="message">
                Sampling top {orgUsersScanned ?? 50} users by storage.
                Showing {items.length.toLocaleString()} items sorted by credits/mo
                {orgTruncated ? ' (capped at 500)' : ''}.
              </span>
            </calcite-notice>
          )}

          {/* Scope toggle — admin only, not in emulation mode */}
          {isAdmin && !viewingUser && (
            <calcite-segmented-control ref={scopeControlRef} scale="s" width="full">
              <calcite-segmented-control-item value="own" checked={viewScope === 'own' || undefined}>
                My Content
              </calcite-segmented-control-item>
              <calcite-segmented-control-item value="org" checked={viewScope === 'org' || undefined}>
                Organisation
              </calcite-segmented-control-item>
            </calcite-segmented-control>
          )}

          {/* Emulation mode — user search (requires portal:admin:viewUsers privilege) */}
          {canEmulate && onEmulateUser && (
            <EmulationCombobox adminUsername={userInfo.username} orgId={userInfo.orgId} onEmulateUser={onEmulateUser} />
          )}
        </calcite-card>
      </div>

      {/* ── Filters ───────────────────────────────────────────── */}
      <div style={{ padding: '1rem 1rem 1rem' }}>
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--calcite-color-text-3)',
          marginBottom: '0.75rem',
        }}>
          Filters
        </div>

        <calcite-label>
          Credits / month
          <calcite-slider
            ref={creditsSliderRef}
            min={0}
            max={maxCredits || 100}
            minValue={filters.minCredits ?? 0}
            maxValue={filters.maxCredits ?? (maxCredits || 100)}
            step={0.1}
            labelHandles
            style={{ marginTop: '0.5rem' }}
          />
          <div style={{ fontSize: '0.8em', color: 'var(--calcite-color-text-3)', marginTop: '0.25rem' }}>
            {(() => {
              const hasMin = filters.minCredits !== null && filters.minCredits > 0
              const hasMax = filters.maxCredits !== null
              if (hasMin && hasMax) return `${filters.minCredits!.toFixed(1)} – ${filters.maxCredits!.toFixed(1)} cr/mo`
              if (hasMin) return `\u2265 ${filters.minCredits!.toFixed(1)} cr/mo`
              if (hasMax) return `\u2264 ${filters.maxCredits!.toFixed(1)} cr/mo`
              return 'No filter'
            })()}
          </div>
        </calcite-label>

        <calcite-label>
          Size
          <calcite-slider
            ref={sizeSliderRef}
            min={0}
            max={SIZE_MAX_IDX}
            minValue={bytesToMinIdx(filters.minSizeBytes)}
            maxValue={bytesToMaxIdx(filters.maxSizeBytes)}
            step={1}
            snap
            labelHandles
            style={{ marginTop: '0.5rem' }}
          />
          <div style={{ fontSize: '0.8em', color: 'var(--calcite-color-text-3)', marginTop: '0.25rem' }}>
            {(() => {
              const minIdx = bytesToMinIdx(filters.minSizeBytes)
              const maxIdx = bytesToMaxIdx(filters.maxSizeBytes)
              const hasMin = filters.minSizeBytes !== null
              const hasMax = filters.maxSizeBytes !== null
              const minLabel = formatSizeMb(SIZE_STEPS_MB[minIdx])
              const maxLabel = formatSizeMb(SIZE_STEPS_MB[maxIdx])
              if (hasMin && hasMax) return `${minLabel} – ${maxLabel}`
              if (hasMin) return `\u2265 ${minLabel}`
              if (hasMax) return `\u2264 ${maxLabel}`
              return 'No filter'
            })()}
          </div>
        </calcite-label>

        <calcite-label>
          Not modified in
          <calcite-select ref={modifiedSelectRef} label="Not modified in">
            {MODIFIED_OPTIONS.map(opt => (
              <calcite-option key={opt.value} value={opt.value}>
                {opt.label}
              </calcite-option>
            ))}
          </calcite-select>
        </calcite-label>
      </div>

    </calcite-shell-panel>
  )
}

interface EmulationComboboxProps {
  adminUsername: string
  orgId: string
  onEmulateUser: (u: string) => void
}

function EmulationCombobox({ adminUsername, orgId, onEmulateUser }: EmulationComboboxProps) {
  const { session } = useAuth()
  const [query, setQuery] = useState('')
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const inputRef = useRef<HTMLCalciteInputTextElement>(null)
  const { data: users = [], isFetching } = useOrgUsers(query, orgId, session, true)

  const filteredUsers = users.filter(u => u.username !== adminUsername)

  // Wire up the text input — listen to Calcite, native input, and keyup for max reliability
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    const handler = () => {
      const val = (el.value as string | undefined)
        ?? el.shadowRoot?.querySelector('input')?.value
        ?? ''
      setQuery(val)
    }
    el.addEventListener('calciteInputTextInput', handler)
    el.addEventListener('input', handler)
    el.addEventListener('keyup', handler)
    return () => {
      el.removeEventListener('calciteInputTextInput', handler)
      el.removeEventListener('input', handler)
      el.removeEventListener('keyup', handler)
    }
  }, [])

  // Track input position for the portalled dropdown — must update whenever results appear
  const showResults = query.length >= 2
  const hasResults = filteredUsers.length > 0

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!showResults) { setDropdownPos(null); return }
    const el = inputRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width })
  }, [showResults, hasResults])

  function selectUser(username: string) {
    onEmulateUser(username)
    setQuery('')
    setDropdownPos(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const dropdownStyle: React.CSSProperties = {
    position: 'fixed',
    top: dropdownPos?.top ?? 0,
    left: dropdownPos?.left ?? 0,
    width: dropdownPos?.width ?? 200,
    zIndex: 9999,
    border: '1px solid var(--calcite-color-border-2)',
    borderRadius: '4px',
    overflow: 'hidden',
    background: 'var(--calcite-color-foreground-1)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    fontFamily: 'var(--calcite-font-family, Avenir Next, sans-serif)',
  }

  return (
    <div style={{ marginTop: '0.75rem' }}>
      <calcite-input-text
        ref={inputRef}
        placeholder="Search user to emulate"
        scale="s"
        clearable
        icon="user"
        loading={isFetching || undefined}
      />

      {showResults && dropdownPos && hasResults && createPortal(
        <div style={dropdownStyle}>
          {filteredUsers.slice(0, 8).map(u => (
            <button
              key={u.username}
              onClick={() => selectUser(u.username)}
              style={{
                display: 'block',
                width: '100%',
                padding: '6px 10px',
                textAlign: 'left',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid var(--calcite-color-border-3)',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--calcite-color-foreground-2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--calcite-color-text-1)' }}>
                {u.fullName}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--calcite-color-text-3)' }}>
                {u.username}
              </div>
            </button>
          ))}
        </div>,
        document.body
      )}

      {showResults && dropdownPos && !isFetching && !hasResults && createPortal(
        <div style={{ ...dropdownStyle, padding: '8px 10px', fontSize: '12px', color: 'var(--calcite-color-text-3)' }}>
          No users found
        </div>,
        document.body
      )}
    </div>
  )
}
