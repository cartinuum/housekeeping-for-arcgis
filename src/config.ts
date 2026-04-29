/** Vite `base` (always ends with `/`). Use for files in `public/`. */
export function publicAssetUrl(path: string): string {
  const p = path.startsWith('/') ? path.slice(1) : path
  return `${import.meta.env.BASE_URL}${p}`
}

export const CLIENT_ID = import.meta.env.VITE_ARCGIS_CLIENT_ID ?? 'bQXhIxIaShwu5Qzt'

// In development, Vite runs on 5173. In production, update to your domain.
export const REDIRECT_URI =
  typeof window !== 'undefined'
    ? window.location.origin
    : 'http://localhost:5173'

export const PORTAL_URL = 'https://www.arcgis.com/sharing/rest'

export const SESSION_KEY = 'hk_session'
