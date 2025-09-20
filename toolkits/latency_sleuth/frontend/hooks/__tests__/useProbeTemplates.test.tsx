import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import type { ToolkitRuntime } from '../../runtime'

let useProbeTemplates: typeof import('../useProbeTemplates')['useProbeTemplates']

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

beforeEach(async () => {
  await vi.resetModules()
  activeReact = createFakeReact()
  const runtime: ToolkitRuntime = {
    react: reactProxy as any,
    reactRouterDom: {} as any,
    apiFetch: vi.fn(),
  }
  window.__SRE_TOOLKIT_RUNTIME = runtime
  useProbeTemplates = (await import('../useProbeTemplates')).useProbeTemplates
})

afterEach(() => {
  delete window.__SRE_TOOLKIT_RUNTIME
  activeReact = createFakeReact()
})

describe('useProbeTemplates', () => {
  it('loads templates on mount', async () => {
    const templates = [
      {
        id: 't-1',
        name: 'Checkout',
        description: null,
        url: 'https://example.com/checkout',
        method: 'GET' as const,
        sla_ms: 420,
        interval_seconds: 120,
        notification_rules: [],
        tags: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]
    const apiFetch = vi.fn().mockResolvedValue(templates)
    window.__SRE_TOOLKIT_RUNTIME!.apiFetch = apiFetch

    const hook = renderHook(() => useProbeTemplates())

    expect(apiFetch).toHaveBeenCalledWith('/toolkits/latency-sleuth/probe-templates', expect.any(Object))

    await hook.result.current.refresh()
    hook.rerender()

    expect(hook.result.current.templates).toHaveLength(1)
    expect(hook.result.current.templates[0].name).toBe('Checkout')
  })

  it('creates templates and updates state', async () => {
    const templates: any[] = []
    const apiFetch = vi.fn().mockImplementation(async (path: string, options?: RequestInit & { json?: unknown }) => {
      if (options?.method === 'POST') {
        const payload = options.json as any
        const created = {
          id: 'generated',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          notification_rules: [],
          tags: [],
          method: 'GET',
          interval_seconds: 300,
          ...payload,
        }
        templates.push(created)
        return created
      }
      if (options?.method === 'DELETE') {
        const targetId = path.split('/').pop()
        const index = templates.findIndex((item) => item.id === targetId)
        if (index >= 0) {
          templates.splice(index, 1)
        }
        return null
      }
      return templates.slice()
    })
    window.__SRE_TOOLKIT_RUNTIME!.apiFetch = apiFetch

    const hook = renderHook(() => useProbeTemplates())

    await Promise.resolve()
    hook.rerender()

    await hook.result.current.createTemplate({ name: 'Checkout', url: 'https://example.com', sla_ms: 400 })
    hook.rerender()

    const postCall = apiFetch.mock.calls.find(([, options]) => (options as RequestInit | undefined)?.method === 'POST')
    expect(postCall?.[1]?.method).toBe('POST')
    expect(postCall?.[1]?.body).toBe(JSON.stringify({ name: 'Checkout', url: 'https://example.com', sla_ms: 400 }))
    expect(hook.result.current.templates).toHaveLength(1)

    await hook.result.current.removeTemplate('generated')
    hook.rerender()

    const deleteCall = apiFetch.mock.calls.find(([path]) => path === '/toolkits/latency-sleuth/probe-templates/generated')
    expect(deleteCall).toBeTruthy()
    expect(deleteCall?.[1]?.method).toBe('DELETE')
    expect(hook.result.current.templates).toHaveLength(0)
  })
})
