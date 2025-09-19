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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [providers, setProviders] = useState<AuthProviderMetadata[]>([])
  const [loading, setLoading] = useState(true)
  const loadingRef = useRef(false)

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
    // Attempt to open window before async work to avoid popup blockers
    const popup = typeof window !== 'undefined' ? window.open('', 'sre-toolbox-auth', 'width=520,height=640') : null
    try {
      const params = new URLSearchParams()
      if (typeof window !== 'undefined') {
        params.set('next', window.location.origin)
        params.set('mode', 'popup')
      }
      const response = await apiFetch<{ type: string; url?: string }>(
        `/auth/providers/${providerName}/begin?${params.toString()}`,
        { retry: false }
      )
      if (response.type === 'redirect' && response.url) {
        if (popup) {
          popup.location.href = response.url
        } else {
          window.open(response.url, '_blank', 'noopener')
        }
      } else if (response.type === 'form') {
        if (popup) {
          popup.close()
        }
        throw new Error('Provider requires credential form login. Use username/password instead.')
      }
    } catch (err) {
      if (popup && !popup.closed) {
        popup.close()
      }
      throw err
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
    if (loadingRef.current) {
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
  }, [loadProviders, refreshUser])

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
