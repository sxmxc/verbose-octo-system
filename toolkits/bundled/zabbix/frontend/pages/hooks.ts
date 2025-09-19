import type { ZabbixInstance } from './types'
import { apiFetch, getReactRuntime } from '../runtime'

const React = getReactRuntime()
const { useCallback, useEffect, useMemo, useState } = React


type UseInstancesOptions = {
  autoSelectFirst?: boolean
}


type UseInstancesResult = {
  instances: ZabbixInstance[]
  selectedId: string
  setSelectedId: (id: string) => void
  selectedInstance: ZabbixInstance | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}


export function useZabbixInstances(options: UseInstancesOptions = {}): UseInstancesResult {
  const { autoSelectFirst = true } = options
  const [instances, setInstances] = useState<ZabbixInstance[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<ZabbixInstance[]>('/toolkits/zabbix/instances')
      setInstances(data)
      setSelectedId((prev) => {
        if (prev && data.some((instance) => instance.id === prev)) {
          return prev
        }
        if (autoSelectFirst && data.length > 0) {
          return data[0].id
        }
        return ''
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [autoSelectFirst])

  useEffect(() => {
    refresh()
  }, [refresh])

  const selectedInstance = useMemo(
    () => instances.find((instance) => instance.id === selectedId) ?? null,
    [instances, selectedId],
  )

  const handleSetSelectedId = useCallback((id: string) => {
    setSelectedId(id)
  }, [])

  return {
    instances,
    selectedId,
    setSelectedId: handleSetSelectedId,
    selectedInstance,
    loading,
    error,
    refresh,
  }
}
