import { useState, useCallback, createContext } from 'react'
import type { ReactNode } from 'react'
import { ArcGISIdentityManager } from '@esri/arcgis-rest-request'
import { SESSION_KEY } from '../config'

function loadSession(): ArcGISIdentityManager | null {
  const raw = sessionStorage.getItem(SESSION_KEY)
  if (!raw) return null
  try {
    return ArcGISIdentityManager.deserialize(raw)
  } catch {
    sessionStorage.removeItem(SESSION_KEY)
    return null
  }
}

interface AuthContextValue {
  session: ArcGISIdentityManager | null
  signOut: () => void
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextValue>({ session: null, signOut: () => {} })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ArcGISIdentityManager | null>(loadSession)

  const signOut = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY)
    setSession(null)
  }, [])

  return (
    <AuthContext.Provider value={{ session, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
