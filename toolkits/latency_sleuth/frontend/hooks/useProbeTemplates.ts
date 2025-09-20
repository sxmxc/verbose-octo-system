import { apiFetch, getReactRuntime } from '../runtime'
import type { ProbeTemplate, ProbeTemplateCreate } from '../types'

const React = getReactRuntime()
const { useCallback, useEffect, useMemo, useRef, useState } = React

export function useProbeTemplates() {
  const [templates, setTemplates] = useState<ProbeTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const activeRef = useRef(true)

  useEffect(() => {
    activeRef.current = true
    return () => {
      activeRef.current = false
    }
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await apiFetch<ProbeTemplate[]>(
        '/toolkits/latency-sleuth/probe-templates',
      )
      if (!activeRef.current) return
      response.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      setTemplates(response)
    } catch (err) {
      if (!activeRef.current) return
      setError(err instanceof Error ? err.message : 'Failed to load templates')
    } finally {
      if (activeRef.current) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const createTemplate = useCallback(
    async (payload: ProbeTemplateCreate) => {
      const created = await apiFetch<ProbeTemplate>(
        '/toolkits/latency-sleuth/probe-templates',
        { method: 'POST', json: payload },
      )
      if (activeRef.current) {
        setTemplates((prev) => [...prev, created])
      }
      return created
    },
    [],
  )

  const updateTemplate = useCallback(
    async (templateId: string, payload: Partial<ProbeTemplateCreate>) => {
      const updated = await apiFetch<ProbeTemplate>(
        `/toolkits/latency-sleuth/probe-templates/${templateId}`,
        { method: 'PUT', json: payload },
      )
      if (activeRef.current) {
        setTemplates((prev) => prev.map((item) => (item.id === templateId ? updated : item)))
      }
      return updated
    },
    [],
  )

  const removeTemplate = useCallback(async (templateId: string) => {
    await apiFetch(`/toolkits/latency-sleuth/probe-templates/${templateId}`, { method: 'DELETE' })
    if (activeRef.current) {
      setTemplates((prev) => prev.filter((item) => item.id !== templateId))
    }
  }, [])

  const templatesById = useMemo(() => {
    const map = new Map<string, ProbeTemplate>()
    for (const template of templates) {
      map.set(template.id, template)
    }
    return map
  }, [templates])

  return {
    templates,
    templatesById,
    loading,
    error,
    refresh,
    createTemplate,
    updateTemplate,
    removeTemplate,
  }
}
