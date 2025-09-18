const fallbackBase = (() => {
  if (typeof window === 'undefined') return ''
  const url = new URL(window.location.href)
  url.pathname = ''
  url.search = ''
  url.hash = ''
  url.port = import.meta.env.VITE_API_PORT || '8080'
  return url.origin
})()

const rawBase = import.meta.env.VITE_API_BASE_URL ?? fallbackBase
export const API_BASE_URL = rawBase.replace(/\/$/, '')

type FetchOptions = RequestInit & { skipJson?: boolean }

export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { skipJson, headers, body, ...rest } = options
  const computedHeaders: Record<string, string> = { ...(headers || {}) }

  if (!(body instanceof FormData)) {
    computedHeaders['Content-Type'] = computedHeaders['Content-Type'] ?? 'application/json'
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: computedHeaders,
    body,
    ...rest
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Request failed (${res.status}): ${body || res.statusText}`)
  }

  if (skipJson) {
    return undefined as unknown as T
  }

  return (await res.json()) as T
}
