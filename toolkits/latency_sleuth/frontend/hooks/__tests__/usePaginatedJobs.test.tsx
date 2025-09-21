import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import type { ToolkitRuntime } from '../../runtime'
import type { JobRecord } from '../../types'

let usePaginatedJobs: typeof import('../usePaginatedJobs')['usePaginatedJobs']
let templateId: string | null
let jobsSignal: JobRecord[]
const refreshSpy = vi.fn()

if (typeof (globalThis as any).window === 'undefined') {
  ;(globalThis as any).window = {} as any
}

let activeReact: FakeReact = createFakeReact()

const reactProxy: Partial<FakeReact> = {
  useState: (...args: Parameters<FakeReact['useState']>) => activeReact.useState(...(args as [unknown])),
  useRef: (...args: Parameters<FakeReact['useRef']>) => activeReact.useRef(...args),
  useMemo: (...args: Parameters<FakeReact['useMemo']>) => activeReact.useMemo(...args),
  useCallback: (...args: Parameters<FakeReact['useCallback']>) => activeReact.useCallback(...args),
  useEffect: (...args: Parameters<FakeReact['useEffect']>) => activeReact.useEffect(...args),
}

type StateUpdater<T> = (value: T | ((prev: T) => T)) => void

type FakeReact = {
  useState<T>(initial: T): [T, StateUpdater<T>]
  useRef<T>(initial: T): { current: T }
  useMemo<T>(factory: () => T, deps?: unknown[]): T
  useCallback<T extends (...args: any[]) => any>(fn: T, deps?: unknown[]): T
  useEffect(effect: () => void | (() => void), deps?: unknown[]): void
  run<T>(callback: () => T): T
}

function depsChanged(prev: unknown[] | undefined, next: unknown[]): boolean {
  if (!prev) return true
  if (prev.length !== next.length) return true
  for (let index = 0; index < prev.length; index += 1) {
    if (!Object.is(prev[index], next[index])) {
      return true
    }
  }
  return false
}

function createFakeReact(): FakeReact {
  const states: unknown[] = []
  const refs: unknown[] = []
  const memoValues: unknown[] = []
  const memoDeps: (unknown[] | undefined)[] = []
  const effectDeps: (unknown[] | undefined)[] = []
  const cleanupFns: (void | (() => void))[] = []
  const pendingEffects: Array<{ index: number; effect: () => void | (() => void) }> = []
  let cursor = 0

  function useState<T>(initial: T): [T, StateUpdater<T>] {
    const index = cursor++
    if (!(index in states)) {
      states[index] = typeof initial === 'function' ? (initial as () => T)() : initial
    }
    const setState: StateUpdater<T> = (value) => {
      const next = typeof value === 'function' ? (value as (prev: T) => T)(states[index] as T) : value
      states[index] = next
    }
    return [states[index] as T, setState]
  }

  function useRef<T>(initial: T): { current: T } {
    const index = cursor++
    if (!(index in refs)) {
      refs[index] = { current: initial }
    }
    return refs[index] as { current: T }
  }

  function useMemo<T>(factory: () => T, deps: unknown[] = []): T {
    const index = cursor++
    if (!memoDeps[index] || depsChanged(memoDeps[index], deps)) {
      memoValues[index] = factory()
      memoDeps[index] = deps.slice()
    }
    return memoValues[index] as T
  }

  function useCallback<T extends (...args: any[]) => any>(fn: T, deps: unknown[] = []): T {
    return useMemo(() => fn, deps)
  }

  function useEffect(effect: () => void | (() => void), deps: unknown[] = []): void {
    const index = cursor++
    if (!effectDeps[index] || depsChanged(effectDeps[index], deps)) {
      effectDeps[index] = deps.slice()
      pendingEffects.push({ index, effect })
    }
  }

  function run<T>(callback: () => T): T {
    cursor = 0
    const result = callback()
    cursor = 0
    while (pendingEffects.length > 0) {
      const { index, effect } = pendingEffects.shift()!
      if (typeof cleanupFns[index] === 'function') {
        ;(cleanupFns[index] as () => void)()
      }
      cleanupFns[index] = effect()
    }
    return result
  }

  return {
    useState,
    useRef,
    useMemo,
    useCallback,
    useEffect,
    run,
  }
}

function renderHook<T>(callback: () => T) {
  const runtime = window.__SRE_TOOLKIT_RUNTIME!
  const fakeReact = createFakeReact()
  activeReact = fakeReact
  runtime.react = reactProxy as any

  let current: T
  const rerender = () => {
    current = fakeReact.run(callback)
  }

  rerender()

  return {
    result: {
      get current() {
        return current
      },
    },
    rerender,
  }
}

function buildJob(index: number): JobRecord {
  return {
    id: `job-${index}`,
    status: 'succeeded',
    progress: 100,
    logs: [],
    created_at: new Date(2024, 0, index + 1).toISOString(),
    updated_at: new Date(2024, 0, index + 1, 0, 5).toISOString(),
  }
}

vi.mock('../useToolkitJobs', () => ({
  useToolkitJobs: vi.fn(() => ({
    jobs: jobsSignal,
    loading: false,
    error: null,
    refresh: refreshSpy,
  })),
}))

beforeEach(async () => {
  await vi.resetModules()
  activeReact = createFakeReact()
  jobsSignal = []
  templateId = 'template-1'
  refreshSpy.mockReset()
  const runtime: ToolkitRuntime = {
    react: reactProxy as any,
    reactRouterDom: {} as any,
    apiFetch: vi.fn(),
  }
  window.__SRE_TOOLKIT_RUNTIME = runtime
  usePaginatedJobs = (await import('../usePaginatedJobs')).usePaginatedJobs
})

afterEach(() => {
  delete window.__SRE_TOOLKIT_RUNTIME
  activeReact = createFakeReact()
})

describe('usePaginatedJobs', () => {
  it('limits visible jobs and loads more pages on demand', () => {
    jobsSignal = Array.from({ length: 25 }, (_, idx) => buildJob(idx))
    const hook = renderHook(() => usePaginatedJobs(templateId, { pageSize: 10 }))

    expect(hook.result.current.jobs).toHaveLength(10)
    expect(hook.result.current.totalJobs).toBe(25)
    expect(hook.result.current.hasMore).toBe(true)

    hook.result.current.loadMore()
    hook.rerender()

    expect(hook.result.current.jobs).toHaveLength(20)
    expect(hook.result.current.hasMore).toBe(true)

    hook.result.current.loadMore()
    hook.rerender()

    expect(hook.result.current.jobs).toHaveLength(25)
    expect(hook.result.current.hasMore).toBe(false)
  })

  it('resets to the first page when a new job arrives', () => {
    jobsSignal = Array.from({ length: 18 }, (_, idx) => buildJob(idx))
    const hook = renderHook(() => usePaginatedJobs(templateId, { pageSize: 5 }))

    hook.result.current.loadMore()
    hook.rerender()
    expect(hook.result.current.jobs).toHaveLength(10)

    jobsSignal = [buildJob(99), ...jobsSignal]
    hook.rerender()
    hook.rerender()

    expect(hook.result.current.jobs).toHaveLength(5)
    expect(hook.result.current.jobs[0].id).toBe('job-99')
  })

  it('resets pagination when the template changes', () => {
    jobsSignal = Array.from({ length: 12 }, (_, idx) => buildJob(idx))
    const hook = renderHook(() => usePaginatedJobs(templateId, { pageSize: 4 }))

    hook.result.current.loadMore()
    hook.rerender()
    expect(hook.result.current.jobs).toHaveLength(8)

    templateId = 'template-2'
    jobsSignal = Array.from({ length: 3 }, (_, idx) => buildJob(idx))
    hook.rerender()

    expect(hook.result.current.jobs).toHaveLength(3)
    expect(hook.result.current.hasMore).toBe(false)
  })
})
