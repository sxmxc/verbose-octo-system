import { getReactRuntime } from '../runtime'
import { useToolkitJobs } from './useToolkitJobs'

const React = getReactRuntime()
const { useCallback, useEffect, useMemo, useRef, useState } = React

type Options = {
  pageSize?: number
}

function normalisePageSize(size: number | undefined) {
  if (!size || Number.isNaN(size) || size < 1) {
    return 10
  }
  return Math.floor(size)
}

export function usePaginatedJobs(templateId: string | null, options: Options = {}) {
  const pageSize = normalisePageSize(options.pageSize)
  const {
    jobs: allJobs,
    loading,
    error,
    refresh,
  } = useToolkitJobs(templateId)
  const [pages, setPages] = useState(1)
  const latestJobRef = useRef<string | null>(null)

  const latestJobId = allJobs.length > 0 ? allJobs[0].id : null

  useEffect(() => {
    setPages(1)
    latestJobRef.current = latestJobId
  }, [templateId])

  useEffect(() => {
    if (latestJobRef.current && latestJobId && latestJobRef.current !== latestJobId) {
      setPages(1)
    }
    latestJobRef.current = latestJobId
  }, [latestJobId])

  useEffect(() => {
    const maxPages = Math.max(Math.ceil(allJobs.length / pageSize), 1)
    setPages((previous) => Math.min(previous, maxPages))
  }, [allJobs.length, pageSize])

  const jobs = useMemo(() => allJobs.slice(0, pageSize * pages), [allJobs, pageSize, pages])
  const hasMore = jobs.length < allJobs.length

  const loadMore = useCallback(() => {
    if (!hasMore) return
    setPages((previous) => previous + 1)
  }, [hasMore])

  const reset = useCallback(() => setPages(1), [])

  return {
    jobs,
    allJobs,
    totalJobs: allJobs.length,
    hasMore,
    loadMore,
    loading,
    error,
    refresh,
    pageSize,
    reset,
  }
}

export type UsePaginatedJobsReturn = ReturnType<typeof usePaginatedJobs>
