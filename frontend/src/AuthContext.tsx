import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

import { apiFetch } from './api'
import { API_BASE_URL } from './config'
import {
  clearAccessToken,
  getAccessToken,
  refreshAccessToken,
  setAccessToken,
  subscribe,
} from './authStore'

type AuthUser = {
  id: string
  username: string
  display_name: string | null
  email: string | null
  roles: string[]
  is_superuser: boolean
}

type AuthProviderMetadata = {
  name: string
  display_name: string
  type: string
}

type AuthContextValue = {
  user: AuthUser | null
  loading: boolean
  providers: AuthProviderMetadata[]
  loginWithPassword: (provider: string, credentials: { username: string; password: string }) => Promise<void>
  beginSso: (provider: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<AuthUser | null>
  hasRole: (role: string) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

type AuthExtractionResult = {
  encoded: string
  cleaned: string
}

function extractAuthFromHash(hash: string): AuthExtractionResult | null {
  if (!hash) return null
  const trimmed = hash.startsWith('#') ? hash.slice(1) : hash
  if (!trimmed) return null

  const hasQuery = trimmed.includes('?')
  if (!hasQuery) {
    const params = new URLSearchParams(trimmed)
    const encoded = params.get('auth')
    if (!encoded) {
      return null
    }
    params.delete('auth')
    return { encoded, cleaned: params.toString() }
  }

  const queryIndex = trimmed.indexOf('?')
  const rawPath = trimmed.slice(0, queryIndex)
  let pathPart = rawPath
  if (rawPath) {
    try {
      pathPart = decodeURIComponent(rawPath)
    } catch (err) {
      console.warn('Failed to decode auth hash path', err)
      pathPart = rawPath
    }
  }
  const queryPart = trimmed.slice(queryIndex + 1)
  const queryParams = new URLSearchParams(queryPart)
  const encoded = queryParams.get('auth')
  if (!encoded) {
    return null
  }
  queryParams.delete('auth')
  const remainingQuery = queryParams.toString()
  const cleaned = pathPart
    ? remainingQuery
      ? `${pathPart}?${remainingQuery}`
      : pathPart
    : remainingQuery
  return { encoded, cleaned }
}

function extractAuthFromSearch(search: string): AuthExtractionResult | null {
  if (!search) return null
  const trimmed = search.startsWith('?') ? search.slice(1) : search
  if (!trimmed) return null

  const params = new URLSearchParams(trimmed)
  const encoded = params.get('auth')
  if (!encoded) {
    return null
  }
  params.delete('auth')
  return { encoded, cleaned: params.toString() }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [providers, setProviders] = useState<AuthProviderMetadata[]>([])
  const [loading, setLoading] = useState(true)
  const loadingRef = useRef(false)
  const authConsumedRef = useRef(false)
  const [handshakeComplete, setHandshakeComplete] = useState(false)

  const loadProviders = useCallback(async () => {
    try {
      const response = await apiFetch<{ providers: AuthProviderMetadata[] }>('/auth/providers', { retry: false })
      setProviders(response.providers || [])
    } catch (err) {
      console.warn('Failed to load auth providers', err)
    }
  }, [])

  const refreshUser = useCallback(async (): Promise<AuthUser | null> => {
    try {
      const profile = await apiFetch<AuthUser>('/auth/me')
      setUser(profile)
      return profile
    } catch (err) {
      console.warn('Unable to refresh current user', err)
      setUser(null)
      return null
    }
  }, [])

  const loginWithPassword = useCallback(
    async (provider: string, credentials: { username: string; password: string }) => {
      const data = await apiFetch<{ access_token: string; user: AuthUser }>(`/auth/login/${provider}`,
        { method: 'POST', body: credentials, retry: false })
      if (data.access_token) {
        setAccessToken(data.access_token)
      }
      setUser(data.user)
    },
    []
  )

  const beginSso = useCallback(async (providerName: string) => {
    const params = new URLSearchParams()
    if (typeof window !== 'undefined') {
      params.set('next', window.location.origin)
    }
    const response = await apiFetch<{ type: string; url?: string }>(
      `/auth/providers/${providerName}/begin?${params.toString()}`,
      { method: 'POST', retry: false }
    )
    if (response.type === 'redirect' && response.url) {
      if (typeof window !== 'undefined') {
        window.location.href = response.url
      }
    } else if (response.type === 'form') {
      throw new Error('Provider requires credential form login. Use username/password instead.')
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST', skipJson: true, retry: false })
    } catch (err) {
      console.warn('Failed to logout cleanly', err)
    } finally {
      clearAccessToken()
      setUser(null)
    }
  }, [])

  useEffect(() => {
    const unsubscribe = subscribe((token) => {
      if (!token) {
        setUser(null)
      }
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined' && !authConsumedRef.current) {
      const url = new URL(window.location.href)
      let cleanupSource: 'hash' | 'search' | null = null
      let cleanupValue = ''
      let encoded: string | null = null

      const hashExtraction = extractAuthFromHash(url.hash)
      if (hashExtraction) {
        encoded = hashExtraction.encoded
        cleanupSource = 'hash'
        cleanupValue = hashExtraction.cleaned
      } else {
        const searchExtraction = extractAuthFromSearch(url.search)
        if (searchExtraction) {
          encoded = searchExtraction.encoded
          cleanupSource = 'search'
          cleanupValue = searchExtraction.cleaned
        }
      }

      if (encoded) {
        const padded = encoded + '==='.slice((encoded.length + 3) % 4)
        try {
          const normalized = padded.replace(/-/g, '+').replace(/_/g, '/')
          const decoded = JSON.parse(atob(normalized)) as { access_token?: string; user?: AuthUser }
          const payload = decoded
          if (payload?.access_token) {
            setAccessToken(payload.access_token)
          }
          if (payload?.user) {
            setUser(payload.user)
          } else {
            // Ensure we refresh user data if not provided.
            refreshUser().catch((err) => console.warn('Failed to refresh user after SSO handoff', err))
          }
        } catch (err) {
          console.warn('Failed to parse auth handoff payload', err)
        }
        if (cleanupSource === 'hash') {
          url.hash = cleanupValue
        } else if (cleanupSource === 'search') {
          url.search = cleanupValue
        }
        if (cleanupSource) {
          window.history.replaceState({}, '', url.toString())
        }
      }
      authConsumedRef.current = true
    }
    setHandshakeComplete(true)
  }, [refreshUser])

  useEffect(() => {
    if (!handshakeComplete || loadingRef.current) {
      return
    }
    loadingRef.current = true

    let cancelled = false
    ;(async () => {
      try {
        await loadProviders()
        if (cancelled) return

        const token = getAccessToken()
        if (!token) {
          await refreshAccessToken()
        }
        if (cancelled) return

        if (getAccessToken()) {
          await refreshUser()
        }
      } catch (err) {
        console.warn('Initial auth bootstrap failed', err)
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
      loadingRef.current = false
    }
  }, [handshakeComplete, loadProviders, refreshUser])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    const handler = (event: MessageEvent) => {
      if (!event?.data || typeof event.data !== 'object') return
      if (event.origin && event.origin !== window.location.origin) return
      const { type, payload } = event.data as { type?: string; payload?: { access_token?: string; user?: AuthUser } }
      if (type === 'sre-toolbox:auth' && payload) {
        if (payload.access_token) {
          setAccessToken(payload.access_token)
        }
        if (payload.user) {
          setUser(payload.user)
        } else {
          refreshUser()
        }
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [refreshUser])

  const hasRole = useCallback(
    (role: string) => {
      if (!user) return false
      if (user.is_superuser) return true
      return user.roles?.includes(role)
    },
    [user]
  )

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, providers, loginWithPassword, beginSso, logout, refreshUser, hasRole }),
    [user, loading, providers, loginWithPassword, beginSso, logout, refreshUser, hasRole]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
