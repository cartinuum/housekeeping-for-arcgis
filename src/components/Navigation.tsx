import { useRef, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { useAuth } from '../auth/useAuth'
import type { UserInfo } from '../types/arcgis'

interface NavigationProps {
  userInfo: UserInfo
  onSignOut: () => void
}

export function Navigation({ userInfo, onSignOut }: NavigationProps) {
  const navigate = useNavigate()
  const { viewingUser, setViewingUser } = useAppStore()
  const { session } = useAuth()
  const noticeRef = useRef<HTMLCalciteNoticeElement>(null)
  const popoverRef = useRef<HTMLCalcitePopoverElement>(null)
  const triggerRef = useRef<HTMLDivElement>(null)

  // Emulation mode notice close handler.
  // viewingUser in deps ensures this re-runs when the notice mounts (on first emulation start).
  // Without it, the effect only runs once on mount when viewingUser is null and the notice
  // hasn't rendered yet — so noticeRef.current is null and the listener is never registered.
  useEffect(() => {
    const el = noticeRef.current
    if (!el) return
    const handler = () => setViewingUser(null)
    el.addEventListener('calciteNoticeClose', handler)
    return () => el.removeEventListener('calciteNoticeClose', handler)
  }, [setViewingUser, viewingUser])

  // Wire popover's referenceElement and toggle click via native events —
  // React synthetic onClick does not fire reliably on elements slotted into
  // a Calcite web component's shadow DOM.
  useEffect(() => {
    const popover = popoverRef.current
    const trigger = triggerRef.current
    if (!popover || !trigger) return
    popover.referenceElement = trigger
    // Defer to next tick so Calcite's own document click-outside handler
    // (which closes the popover) runs first on the same event, sees the
    // popover as closed, and does nothing. Then we open it.
    let tid: ReturnType<typeof setTimeout>
    const toggle = () => {
      const wasOpen = popover.open
      clearTimeout(tid)
      tid = setTimeout(() => { popover.open = !wasOpen }, 0)
    }
    trigger.addEventListener('click', toggle)
    return () => { trigger.removeEventListener('click', toggle); clearTimeout(tid) }
  }, [])

  // Close popover when clicking outside both trigger and popover
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const popover = popoverRef.current
      const trigger = triggerRef.current
      if (!popover || !popover.open) return
      if (popover.contains(e.target as Node) || trigger?.contains(e.target as Node)) return
      popover.open = false
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const [avatarError, setAvatarError] = useState(false)

  const token = session?.token
  const avatarUrl = !avatarError && userInfo.thumbnail
    ? `https://www.arcgis.com/sharing/rest/community/users/${encodeURIComponent(userInfo.username)}/info/${userInfo.thumbnail}${token ? `?token=${encodeURIComponent(token)}` : ''}`
    : undefined

  // Popover portalled to document.body — calcite-navigation's shadow DOM clips
  // any floating-ui positioned elements rendered inside it (0×0 bounding rect).
  const profilePopover = createPortal(
    <calcite-popover
      ref={popoverRef}
      label="Profile"
      placement="bottom-end"
      referenceElement="profile-popover-anchor"
    >
      <div style={{ padding: '1rem', minWidth: 220 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={userInfo.fullName}
              width={56}
              height={56}
              style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
              onError={() => setAvatarError(true)}
            />
          ) : (
            <calcite-avatar scale="l" fullName={userInfo.fullName} />
          )}
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{userInfo.fullName}</div>
            <div style={{ fontSize: 12, color: 'var(--calcite-color-text-3)', marginBottom: 6 }}>
              {userInfo.username}
            </div>
            <calcite-chip kind="neutral" scale="s" label={userInfo.role}>
              {userInfo.role}
            </calcite-chip>
          </div>
        </div>
        <calcite-button
          width="full"
          appearance="outline"
          kind="danger"
          iconStart="sign-out"
          onClick={onSignOut}
        >
          Sign out
        </calcite-button>
      </div>
    </calcite-popover>,
    document.body
  )

  return (
    <>
      <calcite-navigation slot="header">
        {/* Wrap logo in a button so clicking it returns to the inventory (treemap).
            calcite-navigation-logo has no built-in href support. */}
        <div
          slot="logo"
          role="button"
          aria-label="Go to inventory"
          tabIndex={0}
          onClick={() => navigate('/')}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') navigate('/') }}
          style={{ cursor: 'pointer', display: 'flex' }}
        >
          <calcite-navigation-logo
            heading="Housekeeping for ArcGIS"
            thumbnail="/logo.svg"
            description="Housekeeping for ArcGIS"
          />
        </div>

        {viewingUser && (
          <calcite-notice
            ref={noticeRef}
            slot="content-center"
            kind="warning"
            open
            closable
          >
            <span slot="message">
              <calcite-icon icon="view-mixed" scale="s" /> Viewing as:{' '}
              <strong>{viewingUser}</strong>
            </span>
          </calcite-notice>
        )}

        {/* Profile trigger */}
        <div
          ref={triggerRef}
          slot="user"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              triggerRef.current?.click()
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            padding: '4px 12px',
            borderRadius: '4px',
            userSelect: 'none',
            outline: 'none',
          }}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={userInfo.fullName}
              width={32}
              height={32}
              style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
              onError={() => setAvatarError(true)}
            />
          ) : (
            <calcite-avatar scale="m" fullName={userInfo.fullName} />
          )}
          <div style={{ lineHeight: 1.3 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{userInfo.fullName}</div>
            <div style={{ fontSize: 12, color: 'var(--calcite-color-text-3)' }}>{userInfo.username}</div>
          </div>
          <calcite-icon icon="chevron-down" scale="s" style={{ marginLeft: 4 }} />
        </div>
      </calcite-navigation>

      {profilePopover}
    </>
  )
}
