const fallbackBase = (() => {
  if (typeof window === 'undefined') return ''
  try {
    const url = new URL(window.location.href)
    url.pathname = ''
    url.search = ''
    url.hash = ''
    if (import.meta.env.VITE_API_BASE_URL) {
      return import.meta.env.VITE_API_BASE_URL
    }
    if (import.meta.env.VITE_API_PORT) {
      url.port = import.meta.env.VITE_API_PORT
    }
    return url.origin
  } catch (err) {
    console.warn('Failed to compute API fallback base URL', err)
    return ''
  }
})()

const rawBase = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? fallbackBase
export const API_BASE_URL = (rawBase || '').replace(/\/$/, '')
