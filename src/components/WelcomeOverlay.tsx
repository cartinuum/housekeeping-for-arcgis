import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const STORAGE_KEY = 'hk_welcome_seen'

interface WelcomeOverlayProps {
  username: string     // used to key the dismissed state per user on shared machines
  canEmulate: boolean  // true when user has portal:admin:viewUsers privilege
}

export function WelcomeOverlay({ username, canEmulate }: WelcomeOverlayProps) {
  const storageKey = `${STORAGE_KEY}_${username}`
  const [visible, setVisible] = useState(() => {
    try { return localStorage.getItem(storageKey) !== '1' } catch { return true }
  })
  // Pre-ticked: most users want the dialog gone after reading it once.
  const [dontShowAgain, setDontShowAgain] = useState(true)

  const closeBtnRef = useRef<HTMLButtonElement>(null)

  const dismiss = (persist = dontShowAgain) => {
    if (persist) {
      try { localStorage.setItem(storageKey, '1') } catch { /* storage unavailable */ }
    }
    setVisible(false)
  }

  // Move focus to the dismiss button when overlay opens
  useEffect(() => {
    if (visible) closeBtnRef.current?.focus()
  }, [visible])

  // ESC closes for this session only (doesn't persist, respects checkbox state)
  useEffect(() => {
    if (!visible) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [visible, dontShowAgain]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible) return null

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Housekeeping for ArcGIS Online"
    >
      <div
        style={{
          background: 'var(--calcite-color-foreground-1)',
          borderRadius: 8,
          boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
          width: '100%',
          maxWidth: 560,
          margin: '0 16px',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'var(--calcite-font-family, Avenir Next, sans-serif)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--calcite-color-border-2)',
        }}>
          <div style={{
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--calcite-color-text-1)',
            marginBottom: 6,
          }}>
            Welcome to Housekeeping
          </div>
          <div style={{ fontSize: 13, color: 'var(--calcite-color-text-2)', lineHeight: 1.5 }}>
            A simple tool to help you identify and tidy up your ArcGIS Online content.
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 24px', overflowY: 'auto', maxHeight: '60vh' }}>

          {/* Workflow steps */}
          <div style={{ marginBottom: 20 }}>
            <div style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--calcite-color-text-3)',
              marginBottom: 12,
            }}>
              How it works
            </div>

            {[
              {
                num: '1',
                title: 'Inventory',
                body: 'See your content as a treemap — tiles sized by credit cost or storage. Click any tile to add it to your review basket.',
              },
              {
                num: '2',
                title: 'Triage',
                body: 'Review selected items in depth. See owner contact, activity, staleness, and dependency signals for each item.',
              },
              {
                num: '3',
                title: 'Action',
                body: 'Compose pre-filled notification emails for content owners. Buttons open your default mail client — nothing is sent automatically.',
              },
            ].map(step => (
              <div key={step.num} style={{
                display: 'flex',
                gap: 12,
                marginBottom: 12,
              }}>
                <div style={{
                  width: 24, height: 24,
                  borderRadius: '50%',
                  background: 'var(--calcite-color-brand)',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: 1,
                }}>
                  {step.num}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--calcite-color-text-1)', marginBottom: 2 }}>
                    {step.title}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--calcite-color-text-2)', lineHeight: 1.5 }}>
                    {step.body}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Admin section — only shown to users who can emulate (portal:admin:viewUsers) */}
          {canEmulate && (
            <div style={{
              background: 'var(--calcite-color-foreground-2)',
              border: '1px solid var(--calcite-color-border-2)',
              borderRadius: 6,
              padding: '12px 14px',
            }}>
              <div style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--calcite-color-brand)',
                marginBottom: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <calcite-icon icon={'organization' as any} scale="s" />
                Organisation administrator
              </div>
              {[
                'Switch between "My content" and "Organisation" scope using the toggle in the sidebar.',
                'Use Emulation Mode to browse content as any user in your organisation.',
                'The Action stage lets you send notification emails to content owners.',
              ].map((line, i) => (
                <div key={i} style={{
                  display: 'flex',
                  gap: 8,
                  marginBottom: i < 2 ? 8 : 0,
                  fontSize: 12,
                  color: 'var(--calcite-color-text-2)',
                  lineHeight: 1.5,
                }}>
                  <span style={{ color: 'var(--calcite-color-brand)', fontWeight: 700, flexShrink: 0 }}>·</span>
                  {line}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid var(--calcite-color-border-2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}>
          {/* "Don't show again" checkbox — standard onboarding dialog pattern */}
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            color: 'var(--calcite-color-text-2)',
            cursor: 'pointer',
            userSelect: 'none',
          }}>
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={e => setDontShowAgain(e.target.checked)}
              style={{ cursor: 'pointer', accentColor: 'var(--calcite-color-brand)', width: 14, height: 14 }}
            />
            Don't show this again
          </label>

          <button
            ref={closeBtnRef}
            onClick={() => dismiss()}
            style={{
              background: 'var(--calcite-color-brand)',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              padding: '8px 20px',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
