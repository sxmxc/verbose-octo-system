import type * as ReactNamespace from 'react'
import type * as ReactRouterDomNamespace from 'react-router-dom'

export type ToolkitRuntime = {
  react: typeof ReactNamespace
  reactRouterDom: typeof ReactRouterDomNamespace
  apiFetch: (path: string, options?: RequestInit & { json?: unknown }) => Promise<any>
}

declare global {
  interface Window {
    __SRE_TOOLKIT_RUNTIME?: ToolkitRuntime
  }
}

export function getToolkitRuntime(): ToolkitRuntime {
  if (typeof window === 'undefined' || !window.__SRE_TOOLKIT_RUNTIME) {
    throw new Error('SRE Toolkit runtime not injected yet')
  }
  return window.__SRE_TOOLKIT_RUNTIME
}

export function getReactRuntime() {
  return getToolkitRuntime().react
}

export function getRouterRuntime() {
  return getToolkitRuntime().reactRouterDom
}

export function apiFetch<T = unknown>(path: string, options: RequestInit & { json?: unknown } = {}) {
  const runtime = getToolkitRuntime()
  const headers = new Headers(options.headers)
  if (options.json !== undefined) {
    headers.set('Content-Type', 'application/json')
  }
  const request: RequestInit = {
    ...options,
    headers,
    body: options.json !== undefined ? JSON.stringify(options.json) : options.body,
  }
  return runtime.apiFetch(path, request) as Promise<T>
}
