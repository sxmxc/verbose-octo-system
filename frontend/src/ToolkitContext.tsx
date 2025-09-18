import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'

import { apiFetch } from './api'
import { ToolkitSummary } from './types'


export type ToolkitRecord = ToolkitSummary & {
  enabled: boolean
  category: string
  tags: string[]
  origin: string
  created_at: string
  updated_at: string
  backend_module?: string | null
  backend_router_attr?: string | null
  worker_module?: string | null
  worker_register_attr?: string | null
  dashboard_cards?: Array<{
    title: string
    body: string
    link_text?: string
    link_href?: string
    icon?: string
  }>
  dashboard_context_module?: string | null
  dashboard_context_attr?: string | null
  frontend_entry?: string | null
  frontend_source_entry?: string | null
}

type ToolkitContextShape = {
  toolkits: ToolkitRecord[]
  loading: boolean
  refresh: () => Promise<void>
  updateLocal(slug: string, updater: (toolkit: ToolkitRecord) => ToolkitRecord): void
}

const ToolkitContext = createContext<ToolkitContextShape | null>(null)


export function ToolkitProvider({ children }: { children: React.ReactNode }) {
  const [toolkits, setToolkits] = useState<ToolkitRecord[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const response = await apiFetch<ToolkitRecord[]>('/toolkits')
      setToolkits(response)
    } catch (err) {
      console.error('Failed to load toolkits', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const updateLocal = useCallback((slug: string, updater: (toolkit: ToolkitRecord) => ToolkitRecord) => {
    setToolkits((prev) => prev.map((toolkit) => (toolkit.slug === slug ? updater(toolkit) : toolkit)))
  }, [])

  const value: ToolkitContextShape = {
    toolkits,
    loading,
    refresh,
    updateLocal,
  }

  return <ToolkitContext.Provider value={value}>{children}</ToolkitContext.Provider>
}


export function useToolkits() {
  const ctx = useContext(ToolkitContext)
  if (!ctx) {
    throw new Error('useToolkits must be used within ToolkitProvider')
  }
  return ctx
}
