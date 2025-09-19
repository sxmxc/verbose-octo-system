import { API_BASE_URL } from './config'

const STORAGE_KEY = 'sre-toolbox.accessToken'

type Listener = (token: string | null) => void

let accessToken: string | null = null
if (typeof window !== 'undefined') {
  try {
    accessToken = window.localStorage.getItem(STORAGE_KEY)
  } catch (err) {
    console.warn('Unable to read access token from storage', err)
    accessToken = null
  }
}

const listeners = new Set<Listener>()
let refreshPromise: Promise<string | null> | null = null

export function getAccessToken() {
  return accessToken
}

export function setAccessToken(token: string | null) {
  accessToken = token
  if (typeof window !== 'undefined') {
    try {
      if (token) {
        window.localStorage.setItem(STORAGE_KEY, token)
      } else {
        window.localStorage.removeItem(STORAGE_KEY)
      }
    } catch (err) {
      console.warn('Unable to persist access token', err)
    }
  }
  listeners.forEach((listener) => listener(accessToken))
}

export function clearAccessToken() {
  setAccessToken(null)
}

export function subscribe(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

async function performRefresh(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({}),
    })
    if (!res.ok) {
      clearAccessToken()
      return null
    }
    const data = (await res.json()) as { access_token?: string }
    if (data?.access_token) {
      setAccessToken(data.access_token)
      return data.access_token
    }
    clearAccessToken()
    return null
  } catch (err) {
    console.warn('Failed to refresh access token', err)
    clearAccessToken()
    return null
  }
}

export async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}
