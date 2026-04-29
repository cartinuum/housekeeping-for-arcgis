import { useEffect } from 'react'
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './auth/useAuth'
import { SignInPage } from './auth/SignInPage'
import { useUserInfo, usePortalSelf } from './api/userInfo'
import { useUserContent } from './api/userContent'
import { useOrgContent } from './api/orgContent'
import { useAppStore } from './store/useAppStore'
import { Navigation } from './components/Navigation'
import { Sidebar } from './components/Sidebar'
import { Dashboard } from './components/Dashboard'
import { ReviewPanel } from './components/ReviewPanel'
import { ActionPanel } from './components/ActionPanel'
import { BasketPanel } from './components/BasketPanel'
import { EmulationBanner } from './components/EmulationBanner'
import { WelcomeOverlay } from './components/WelcomeOverlay'

function AppShell() {
  const { session, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { viewingUser, setViewingUser, viewScope, setIsAdmin, setOrgId, setAdminFullName, setViewingUserFullName, setPortalHostname, selectedIds, sidebarOpen } = useAppStore()

  const signedInUsername = session!.username
  const targetUsername = viewingUser ?? signedInUsername

  // Always fetch signed-in user's info to determine admin role + emulation capability
  const { data: signedInUserInfo } = useUserInfo(signedInUsername, session)
  const { data: portalHostname } = usePortalSelf(session)
  const isAdmin = signedInUserInfo?.role === 'org_admin'
  // Emulation requires portal:admin:viewUsers. All org_admins have it; some custom
  // roles may also have it without being full admins.
  const canEmulate = signedInUserInfo?.privileges.includes('portal:admin:viewUsers') ?? false

  // Store isAdmin in Zustand once resolved so route components can read it without prop-drilling
  useEffect(() => {
    setIsAdmin(isAdmin)
  }, [isAdmin, setIsAdmin])

  // Store orgId in Zustand once resolved so route components can read it without prop-drilling
  useEffect(() => {
    if (signedInUserInfo?.orgId) setOrgId(signedInUserInfo.orgId)
  }, [signedInUserInfo?.orgId, setOrgId])

  // Store admin's full name in Zustand for use in email sign-off
  useEffect(() => {
    if (signedInUserInfo?.fullName) setAdminFullName(signedInUserInfo.fullName)
  }, [signedInUserInfo?.fullName, setAdminFullName])

  // Store org portal hostname — used to build item URLs in the user's portal context
  useEffect(() => {
    if (portalHostname) setPortalHostname(portalHostname)
  }, [portalHostname, setPortalHostname])

  // Fetch display info for the active target (differs from signed-in user in emulation mode)
  const { data: userInfo, isLoading: infoLoading } = useUserInfo(targetUsername, session)

  // Sync emulated user's display name to Zustand so EmulationBanner can read it
  useEffect(() => {
    if (viewingUser && userInfo?.fullName) {
      setViewingUserFullName(userInfo.fullName)
    } else if (!viewingUser) {
      setViewingUserFullName(null)
    }
  }, [viewingUser, userInfo?.fullName, setViewingUserFullName])

  // Org scope: admin viewing all org content (disabled in emulation mode)
  const orgScopeActive = isAdmin && !viewingUser && viewScope === 'org'

  const { data: ownItems = [], isLoading: ownLoading } = useUserContent(
    orgScopeActive ? null : targetUsername,
    session
  )
  const { data: orgData, isLoading: orgLoading } = useOrgContent(
    orgScopeActive ? userInfo?.orgId ?? null : null,
    session
  )

  const orgItems = orgData?.items ?? []
  const items = orgScopeActive ? orgItems : ownItems
  const contentLoading = orgScopeActive ? orgLoading : ownLoading

  // Navigate to / before clearing auth so the router resets cleanly
  const onSignOut = () => {
    navigate('/')
    signOut()
  }

  if (infoLoading || contentLoading || !signedInUserInfo) {
    return (
      <calcite-shell>
        <div
          slot="header"
          style={{ height: '52px', display: 'flex', alignItems: 'center', padding: '0 1rem' }}
        >
          Loading...
        </div>
        <calcite-loader label={orgScopeActive ? 'Sampling top users across the organisation…' : 'Loading content…'} />
      </calcite-shell>
    )
  }

  if (!userInfo) return null

  // Sidebar is only shown on the inventory route
  const showSidebar = location.pathname === '/'

  return (
    <calcite-shell>
      <WelcomeOverlay username={signedInUsername} canEmulate={canEmulate} />
      <Navigation userInfo={signedInUserInfo} onSignOut={onSignOut} />

      {showSidebar && selectedIds.length > 0 && (
        <BasketPanel items={items} />
      )}

      {showSidebar && sidebarOpen && (
        <Sidebar
          userInfo={userInfo}
          items={items}
          isAdmin={isAdmin}
          canEmulate={canEmulate}
          onEmulateUser={setViewingUser}
          orgTotal={orgScopeActive ? (orgData?.total ?? items.length) : undefined}
          orgTruncated={orgScopeActive ? (orgData?.truncated ?? false) : undefined}
          orgUsersScanned={orgScopeActive ? (orgData?.usersScanned ?? 0) : undefined}
        />
      )}

      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {viewingUser && location.pathname !== '/' && <EmulationBanner />}
        <Routes>
          <Route
            path="/"
            element={
              <Dashboard
                items={items}
                orgTotal={orgScopeActive ? (orgData?.total ?? items.length) : undefined}
              />
            }
          />
          <Route path="/review" element={<ReviewPanel items={items} />} />
          <Route path="/action" element={<ActionPanel items={items} />} />
        </Routes>
      </div>
    </calcite-shell>
  )
}

export default function App() {
  const { session } = useAuth()
  if (!session) return <SignInPage />
  return <AppShell />
}
