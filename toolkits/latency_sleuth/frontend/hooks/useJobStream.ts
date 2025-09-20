import { apiFetch, getReactRuntime } from '../runtime'
import type { JobRecord } from '../types'

const React = getReactRuntime()
const { useCallback, useEffect, useRef, useState } = React

const TERMINAL_STATUSES = new Set(['succeeded', 'failed', 'cancelled'])

export function useJobStream(jobId: string | null, pollInterval = 2000) {
  const [job, setJob] = useState<JobRecord | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const activeRef = useRef(true)

  useEffect(() => {
    activeRef.current = true
    return () => {
      activeRef.current = false
    }
  }, [])

  const fetchJob = useCallback(
    async (currentJobId: string) => {
      setLoading(true)
      try {
        const response = await apiFetch<JobRecord>(
          `/toolkits/latency-sleuth/jobs/${currentJobId}`,
        )
        if (!activeRef.current) return response
        setJob(response)
        setError(null)
        return response
      } catch (err) {
        if (!activeRef.current) return null
        setError(err instanceof Error ? err.message : 'Failed to load job status')
        throw err
      } finally {
        if (activeRef.current) {
          setLoading(false)
        }
      }
    },
    [],
  )

  useEffect(() => {
    if (!jobId) {
      setJob(null)
      setError(null)
      setLoading(false)
      return () => {}
    }

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const poll = async () => {
      try {
        const response = await fetchJob(jobId)
        if (!response || TERMINAL_STATUSES.has(response.status) || cancelled) {
          return
        }
        timer = setTimeout(poll, pollInterval)
      } catch {
        timer = setTimeout(poll, pollInterval * 2)
      }
    }

    poll()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [jobId, pollInterval, fetchJob])

  return {
    job,
    loading,
    error,
    refresh: jobId ? () => fetchJob(jobId) : async () => null,
  }
}
