import { API_BASE_URL } from './config'
import { clearAccessToken, getAccessToken, refreshAccessToken } from './authStore'

type FetchOptions = Omit<RequestInit, 'body'> & {
  body?: unknown
  skipJson?: boolean
  retry?: boolean
}

function maybeStringifyBody(body: unknown, headers: Headers): BodyInit | null | undefined {
  if (!body || body instanceof FormData || body instanceof Blob || body instanceof ArrayBuffer) {
    return body as BodyInit | null | undefined
  }
  const contentType = headers.get('Content-Type') || ''
  if (contentType.includes('application/json') && typeof body !== 'string') {
    return JSON.stringify(body)
  }
  return body as BodyInit
}

export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { skipJson, retry = true, headers, body, ...rest } = options
  const computedHeaders = new Headers(headers as HeadersInit)
  const token = getAccessToken()
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData

  if (!isFormData && !computedHeaders.has('Content-Type')) {
    computedHeaders.set('Content-Type', 'application/json')
  }
  computedHeaders.set('Accept', computedHeaders.get('Accept') || 'application/json')

  if (token && !computedHeaders.has('Authorization')) {
    computedHeaders.set('Authorization', `Bearer ${token}`)
  }

  const requestBody = maybeStringifyBody(body, computedHeaders)

  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: computedHeaders,
    body: requestBody,
    credentials: 'include',
    ...rest,
  })

  if (response.status === 401 && retry) {
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      return apiFetch<T>(path, { ...options, retry: false })
    }
    clearAccessToken()
  }

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Request failed (${response.status}): ${text || response.statusText}`)
  }

  if (skipJson || response.status === 204) {
    return undefined as unknown as T
  }

  const contentType = response.headers.get('Content-Type') || ''
  if (!contentType.includes('application/json')) {
    return (await response.text()) as unknown as T
  }
  return (await response.json()) as T
}
