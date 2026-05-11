import React from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ArcGISIdentityManager } from '@esri/arcgis-rest-request'
import { defineCustomElements } from '@esri/calcite-components/loader'
import './styles/main.scss'
import App from './App'
import { CLIENT_ID, REDIRECT_URI, SESSION_KEY } from './config'
import { AuthProvider } from './auth/AuthProvider'

// Register all Calcite web components
defineCustomElements(window)

async function bootstrap() {
  // If this page load is the OAuth redirect callback, exchange the code.
  // This runs before React mounts so the HashRouter never sees the ?code= URL.
  const params = new URLSearchParams(window.location.search)
  if (params.has('code')) {
    try {
      const session = await ArcGISIdentityManager.completeOAuth2({
        clientId: CLIENT_ID,
        redirectUri: REDIRECT_URI,
      })
      sessionStorage.setItem(SESSION_KEY, session.serialize())
    } catch (err) {
      console.error('OAuth callback error:', err)
    }
    // Clean the code from the URL before the router initialises
    window.history.replaceState({}, '', window.location.pathname)
  }

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        retry: 1,
      },
    },
  })

  createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <HashRouter>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </QueryClientProvider>
      </HashRouter>
    </React.StrictMode>
  )
}

bootstrap()
