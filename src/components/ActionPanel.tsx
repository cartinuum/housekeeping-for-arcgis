import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueries } from '@tanstack/react-query'
import { useAppStore } from '../store/useAppStore'
import { useAuth } from '../auth/useAuth'
import { ownerInfoQueryOptions } from '../api/triageSignals'
import { calcCreditsPerMonth } from '../utils/credits'
import { navigateTo } from '../utils/navigation'
import {
  buildEmailBody,
  buildBatchEmailBody,
  buildMailtoUrl,
  isMailtoTooLong,
  groupItemsByOwner,
  EMAIL_SUBJECT,
} from '../utils/notify'
import type { ArcGISItem } from '../types/arcgis'
import { buildItemUrl } from '../utils/portalUrl'
import { iconFor } from '../utils/itemIcons'

interface ActionPanelProps {
  items: ArcGISItem[]
}

function formatCredits(credits: number): string {
  if (credits < 0.01) return '< 0.01'
  if (credits >= 1000) return `${(credits / 1000).toFixed(1)}k`
  return credits.toFixed(2)
}

export function ActionPanel({ items }: ActionPanelProps) {
  const navigate = useNavigate()
  const { session } = useAuth()
  const [searchParams] = useSearchParams()
  const { selectedIds, setSelectedIds, adminFullName, reasonMap, portalHostname } = useAppStore()
  const [clipboardNotice, setClipboardNotice] = useState<string | null>(null)
  const [copiedOwner, setCopiedOwner] = useState<string | null>(null)

  // Hydrate selectedIds from URL on cold load (same pattern as ReviewPanel)
  useEffect(() => {
    const raw = searchParams.get('ids')
    if (raw) {
      const ids = raw.split(',').filter(Boolean)
      if (ids.length > 0) setSelectedIds(ids)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedItems = useMemo(
    () => selectedIds.map(id => items.find(i => i.id === id)).filter((i): i is ArcGISItem => i !== undefined),
    [selectedIds, items]
  )

  const uniqueOwners = useMemo(
    () => [...new Set(selectedItems.map(i => i.owner))],
    [selectedItems]
  )

  // useQueries fetches all owner infos in one hook call — no hooks-in-loop.
  // Pass empty array when session is not yet available (queries stay disabled).
  const ownerInfoResults = useQueries({
    queries: session
      ? uniqueOwners.map(username => ownerInfoQueryOptions(username, session))
      : [],
  })

  // Redirect to inventory if basket is empty
  useEffect(() => {
    if (selectedIds.length === 0) navigate('/', { replace: true })
  }, [selectedIds, navigate])

  if (!session) return null

  // The signed-in user's username — items they own should not trigger self-notifications
  const signedInUsername = session.username

  // Build owner-username → query result lookup
  const ownerInfoMap = new Map(
    uniqueOwners.map((username, i) => [username, ownerInfoResults[i]])
  )

  // Group items by owner; sort groups by total credits desc
  const grouped = groupItemsByOwner(selectedItems)
  const sortedOwners = [...grouped.keys()].sort((a, b) => {
    const total = (owner: string) =>
      (grouped.get(owner) ?? []).reduce(
        (sum, item) => sum + calcCreditsPerMonth(item.type, item.size),
        0
      )
    return total(b) - total(a)
  })

  const adminName = adminFullName ?? 'Your ArcGIS Online administrator'

  // Collect resolved emails for the batch button — exclude the signed-in user
  // (self-notification is meaningless and clutters the email thread)
  const otherOwners = sortedOwners.filter(u => u !== signedInUsername)
  const resolvedOwnerEmails = otherOwners
    .map(u => ownerInfoMap.get(u)?.data?.email)
    .filter((e): e is string => !!e)
  const missingEmailCount = otherOwners.length - resolvedOwnerEmails.length
  const anyLoading = ownerInfoResults.some(r => r.isLoading)

  function openMailto(to: string | string[], body: string) {
    const url = buildMailtoUrl(to, body)
    if (isMailtoTooLong(url)) {
      // Body too long for mail client — copy to clipboard, open blank mailto:
      navigator.clipboard.writeText(body).catch(() => {
        // Clipboard unavailable — user will need to copy manually
      })
      const firstTo = Array.isArray(to) ? to[0] : to
      navigateTo(`mailto:${firstTo}?subject=${encodeURIComponent(EMAIL_SUBJECT)}`)
      setClipboardNotice(
        'The email body was too long for your mail client. It has been copied to your clipboard. Paste it into the message body.'
      )
    } else {
      navigateTo(url)
    }
  }

  function handleBatchSend() {
    const body = buildBatchEmailBody(selectedItems, adminName, reasonMap, portalHostname)
    openMailto(resolvedOwnerEmails, body)
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Sticky header ── */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--calcite-color-border-1)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <calcite-button
            appearance="transparent"
            icon-start="arrow-left"
            onClick={() => navigate(`/review?ids=${selectedIds.join(',')}`)}
          >
            Back to review
          </calcite-button>
          <h2 style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--calcite-color-text-1)',
          }}>
            Notify owners · {selectedItems.length} item{selectedItems.length === 1 ? '' : 's'} · {otherOwners.length} owner{otherOwners.length === 1 ? '' : 's'}
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Wrap in a span so the tooltip can attach even when button is disabled
              (Calcite tooltips don't fire on disabled elements). */}
          <span id="batch-send-btn" style={{ display: 'inline-flex' }}>
            <calcite-button
              icon-start="send"
              disabled={anyLoading || resolvedOwnerEmails.length === 0 || undefined}
              onClick={handleBatchSend}
            >
              Email all owners ({resolvedOwnerEmails.length})
            </calcite-button>
          </span>
          {resolvedOwnerEmails.length === 0 && !anyLoading && (
            <calcite-tooltip referenceElement="batch-send-btn" placement="bottom">
              {otherOwners.length === 0
                ? 'All items in this batch are owned by you — no notification needed.'
                : 'No owner email addresses are on record. Email owners individually once resolved.'}
            </calcite-tooltip>
          )}
          {missingEmailCount > 0 && (
            <span style={{ fontSize: 12, color: 'var(--calcite-color-text-3)' }}>
              {missingEmailCount} owner{missingEmailCount === 1 ? '' : 's'} excluded: no email address on record
            </span>
          )}
        </div>

        <div style={{ fontSize: 11, color: 'var(--calcite-color-text-3)' }}>
          Buttons open your default mail application. If your mail client doesn't open, use the{' '}
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <calcite-icon icon={'copy' as any} scale="s" style={{ verticalAlign: 'middle', margin: '0 2px' }} />
          {' '}copy icon next to each owner's email button to paste the body manually.
        </div>

        {clipboardNotice && (
          <calcite-notice kind="warning" open>
            <span slot="message">{clipboardNotice}</span>
          </calcite-notice>
        )}
      </div>

      {/* ── Scrollable owner groups ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {sortedOwners.map(ownerUsername => {
          const ownerResult = ownerInfoMap.get(ownerUsername)
          const ownerItems = [...(grouped.get(ownerUsername) ?? [])].sort(
            (a, b) =>
              calcCreditsPerMonth(b.type, b.size) -
              calcCreditsPerMonth(a.type, a.size)
          )
          const email = ownerResult?.data?.email ?? null
          const fullName = ownerResult?.data?.fullName ?? ownerUsername
          const btnId = `email-btn-${ownerUsername}`
          const showTooltip = !ownerResult?.isLoading && !email
          const tooltipText = ownerResult?.isError
            ? 'Could not load owner details'
            : 'No email address on record for this user'

          function handleOwnerSend() {
            if (!email) return
            const body = buildEmailBody(ownerItems, fullName, adminName, reasonMap, portalHostname)
            openMailto(email, body)
          }

          function handleOwnerCopy() {
            const body = buildEmailBody(ownerItems, fullName, adminName, reasonMap, portalHostname)
            navigator.clipboard.writeText(body).then(() => {
              setCopiedOwner(ownerUsername)
              setTimeout(() => setCopiedOwner(prev => prev === ownerUsername ? null : prev), 2500)
            }).catch(() => {})
          }

          const isSelf = ownerUsername === signedInUsername

          return (
            <div
              key={ownerUsername}
              style={{ borderBottom: '1px solid var(--calcite-color-border-1)' }}
            >
              {/* Owner header row */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 16px',
                background: 'var(--calcite-color-foreground-2)',
                borderBottom: '1px solid var(--calcite-color-border-3)',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 13,
                  minWidth: 0,
                }}>
                  <calcite-icon icon="user" scale="s" />
                  {ownerResult?.isLoading && (
                    <calcite-loader scale="s" inline label="Loading owner" />
                  )}
                  {ownerResult?.data && (
                    <>
                      <span style={{ fontWeight: 600 }}>{ownerResult.data.fullName}</span>
                      <span style={{ color: 'var(--calcite-color-text-3)' }}>
                        {ownerResult.data.email ?? ownerUsername}
                      </span>
                    </>
                  )}
                  {ownerResult?.isError && (
                    <span style={{ color: 'var(--calcite-color-text-3)' }}>{ownerUsername}</span>
                  )}
                </div>

                <div style={{ flexShrink: 0, display: 'flex', gap: 6, alignItems: 'center' }}>
                  {isSelf ? (
                    // Self-notification guard — you own these items, no email needed
                    <span style={{
                      fontSize: 11,
                      color: 'var(--calcite-color-text-3)',
                      fontStyle: 'italic',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                    }}>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      <calcite-icon icon={'information' as any} scale="s" />
                      Your items — no notification needed
                    </span>
                  ) : (
                    <>
                      <calcite-button
                        id={btnId}
                        scale="s"
                        appearance="outline"
                        icon-start="send"
                        disabled={!email || ownerResult?.isLoading || undefined}
                        onClick={handleOwnerSend}
                      >
                        Email {fullName.split(' ')[0]}
                      </calcite-button>
                      {showTooltip && (
                        <calcite-tooltip referenceElement={btnId} placement="bottom">
                          {tooltipText}
                        </calcite-tooltip>
                      )}
                      <calcite-action
                        id={`copy-btn-${ownerUsername}`}
                        scale="s"
                        icon={copiedOwner === ownerUsername ? 'check' : 'copy'}
                        text={copiedOwner === ownerUsername ? 'Copied' : 'Copy email body'}
                        label={copiedOwner === ownerUsername ? 'Copied' : 'Copy email body to clipboard'}
                        onClick={handleOwnerCopy}
                      />
                      <calcite-tooltip referenceElement={`copy-btn-${ownerUsername}`} placement="bottom">
                        {copiedOwner === ownerUsername ? 'Copied!' : "Copy body (if your email client didn't open)"}
                      </calcite-tooltip>
                    </>
                  )}
                </div>
              </div>

              {/* Items table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <tbody>
                  {ownerItems.map(item => {
                    const credits = calcCreditsPerMonth(item.type, item.size)
                    return (
                      <tr
                        key={item.id}
                        style={{ borderBottom: '1px solid var(--calcite-color-border-3)' }}
                      >
                        <td style={{ padding: '8px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <calcite-icon
                              // eslint-disable-next-line @typescript-eslint/no-explicit-any
                              icon={iconFor(item.type) as any}
                              scale="s"
                              style={{ color: 'var(--calcite-color-text-3)', flexShrink: 0 } as React.CSSProperties}
                            />
                            <a
                              href={buildItemUrl(portalHostname, item.id)}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: 'var(--calcite-color-brand)', textDecoration: 'none' }}
                            >
                              {item.title}
                            </a>
                          </div>
                        </td>
                        <td style={{
                          padding: '8px',
                          color: 'var(--calcite-color-text-3)',
                          whiteSpace: 'nowrap',
                          fontSize: 12,
                        }}>
                          {item.type}
                        </td>
                        <td style={{
                          padding: '8px',
                          whiteSpace: 'nowrap',
                          fontWeight: 600,
                          color: credits > 100
                            ? 'var(--calcite-color-status-danger)'
                            : 'var(--calcite-color-text-2)',
                        }}>
                          {formatCredits(credits)} cr/mo
                        </td>
                        <td style={{ padding: '8px', width: 36 }}>
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
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        })}
      </div>
    </div>
  )
}
