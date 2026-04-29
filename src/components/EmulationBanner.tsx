import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'

export function EmulationBanner() {
  const { viewingUserFullName } = useAppStore()
  const location = useLocation()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const noticeRef = useRef<any>(null)
  const [dismissed, setDismissed] = useState(false)

  // Reset dismissed on every route change so the banner reappears on navigation
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(false)
  }, [location.pathname])

  // Wire calciteNoticeClose via ref + addEventListener (Calcite 5 — JSX onCalcite* unreliable).
  // `dismissed` in deps ensures the listener re-attaches after the element re-mounts on route change.
  useEffect(() => {
    const el = noticeRef.current
    if (!el) return
    const handler = () => setDismissed(true)
    el.addEventListener('calciteNoticeClose', handler)
    return () => el.removeEventListener('calciteNoticeClose', handler)
  }, [dismissed])

  if (dismissed || !viewingUserFullName) return null

  return (
    <calcite-notice
      ref={noticeRef}
      kind="warning"
      open
      closable
      style={{ width: '100%', marginBottom: 0 }}
    >
      <span slot="message">
        You are reviewing content owned by <strong>{viewingUserFullName}</strong>. Actions you take will affect their content.
      </span>
    </calcite-notice>
  )
}
