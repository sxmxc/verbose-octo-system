export type JobLog = {
  ts: string
  message: string
}

export type Job = {
  id: string
  toolkit: string
  module?: string
  operation: string
  status: string
  progress: number
  created_at?: string
  updated_at?: string
  payload?: Record<string, unknown>
  result?: unknown
  error?: string
  logs?: JobLog[]
  celery_task_id?: string | null
}

export type ZabbixInstance = {
  id: string
  name: string
  base_url: string
  verify_tls: boolean
  description?: string | null
  created_at: string
  updated_at: string
  has_token: boolean
}

export type RegexMatch = {
  match: string
  start: number
  end: number
  groups: (string | null)[]
  groupdict: Record<string, string | null>
}

export type RegexTestResponse = {
  ok: boolean
  pattern: string
  flags: string[]
  matches: RegexMatch[]
  error?: string
}

export type ToolkitSummary = {
  slug: string
  name: string
  description: string
  base_path: string
  highlights?: string[]
}
