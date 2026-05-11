/** Vite `base` (always ends with `/`). Use for files in `public/`. */
export function publicAssetUrl(path: string): string {
  const p = path.startsWith('/') ? path.slice(1) : path
  return `${import.meta.env.BASE_URL}${p}`
}

export const CLIENT_ID = import.meta.env.VITE_ARCGIS_CLIENT_ID ?? 'bQXhIxIaShwu5Qzt'

// Full URL where ArcGIS redirects after OAuth (must match redirect URIs on the ArcGIS app).
// `origin` alone breaks GitHub project Pages: app lives at /repo/, not site root.
export const REDIRECT_URI =
  typeof window !== 'undefined'
    ? new URL(import.meta.env.BASE_URL, window.location.origin).href
    : 'http://localhost:5173/'

export const PORTAL_URL = 'https://www.arcgis.com/sharing/rest'

export const SESSION_KEY = 'hk_session'
