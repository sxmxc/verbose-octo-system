import type * as ReactNamespace from 'react'
import type * as ReactRouterDomNamespace from 'react-router-dom'

export type ToolkitRuntime = {
  react: typeof ReactNamespace
  reactRouterDom: typeof ReactRouterDomNamespace
  apiFetch: (path: string, options?: Record<string, unknown>) => Promise<unknown>
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

export function getReactRouterRuntime() {
  return getToolkitRuntime().reactRouterDom
}

export function apiFetch<T = unknown>(path: string, options?: Record<string, unknown>) {
  return getToolkitRuntime().apiFetch(path, options) as Promise<T>
}

