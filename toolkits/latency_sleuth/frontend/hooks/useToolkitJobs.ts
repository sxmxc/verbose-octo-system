import { apiFetch, getReactRuntime } from '../runtime'
import type { JobRecord } from '../types'

const React = getReactRuntime()
const { useCallback, useEffect, useRef, useState } = React

export function useToolkitJobs(templateId: string | null, pollInterval = 10000) {
  const [jobs, setJobs] = useState<JobRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const activeRef = useRef(true)

  useEffect(() => {
    activeRef.current = true
    return () => {
      activeRef.current = false
    }
  }, [])

  const fetchJobs = useCallback(async () => {
    if (!templateId) {
      setJobs([])
      setError(null)
      return []
    }

    setLoading(true)
    try {
      const response = await apiFetch<JobRecord[]>(
        `/toolkits/latency-sleuth/jobs?template_id=${encodeURIComponent(templateId)}`,
      )
      if (!activeRef.current) return response
      setJobs(response)
      setError(null)
      return response
    } catch (err) {
      if (!activeRef.current) return []
      const message = err instanceof Error ? err.message : 'Failed to load jobs'
      setError(message)
      throw err
    } finally {
      if (activeRef.current) {
        setLoading(false)
      }
    }
  }, [templateId])

  useEffect(() => {
    if (!templateId) {
      setJobs([])
      setError(null)
      return () => {}
    }

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const poll = async () => {
      try {
        await fetchJobs()
        if (cancelled) return
        timer = setTimeout(poll, pollInterval)
      } catch {
        if (cancelled) return
        timer = setTimeout(poll, pollInterval * 2)
      }
    }

    poll()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [templateId, pollInterval, fetchJobs])

  return {
    jobs,
    loading,
    error,
    refresh: fetchJobs,
  }
}
