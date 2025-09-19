import { apiFetch, getReactRuntime } from '../runtime'
import type { ConnectivityTarget } from './types'

const React = getReactRuntime()
const { useCallback, useEffect, useMemo, useState } = React

type UseTargetsResult = {
  targets: ConnectivityTarget[]
  selectedId: string
  setSelectedId: (id: string) => void
  selectedTarget: ConnectivityTarget | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useConnectivityTargets(): UseTargetsResult {
  const [targets, setTargets] = useState<ConnectivityTarget[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<ConnectivityTarget[]>('/toolkits/connectivity/targets')
      setTargets(data)
      setSelectedId((prev) => {
        if (prev && data.some((target) => target.id === prev)) {
          return prev
        }
        return data.length > 0 ? data[0].id : ''
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const selectedTarget = useMemo(
    () => targets.find((target) => target.id === selectedId) ?? null,
    [targets, selectedId],
  )

  return {
    targets,
    selectedId,
    setSelectedId,
    selectedTarget,
    loading,
    error,
    refresh,
  }
}
