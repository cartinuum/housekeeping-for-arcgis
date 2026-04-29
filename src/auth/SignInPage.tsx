import { ArcGISIdentityManager } from '@esri/arcgis-rest-request'
import { CLIENT_ID, REDIRECT_URI, PORTAL_URL } from '../config'

export function SignInPage() {
  function handleSignIn() {
    ArcGISIdentityManager.beginOAuth2({
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      portal: PORTAL_URL,
      pkce: true,
      popup: false,
    })
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        gap: '1.5rem',
      }}
    >
      <img src="/logo.svg" width={80} height={80} alt="" />
      <h1 style={{ margin: 0, fontFamily: 'var(--calcite-font-family)' }}>
        Housekeeping for ArcGIS
      </h1>
      <p style={{ margin: 0, color: 'var(--calcite-color-text-3)' }}>
        A simple tool to help tidy up your Web GIS
      </p>
      <calcite-button
        appearance="solid"
        kind="brand"
        icon-start="sign-in"
        onClick={handleSignIn}
      >
        Sign in with ArcGIS Online
      </calcite-button>
    </div>
  )
}
